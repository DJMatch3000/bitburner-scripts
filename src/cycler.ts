import { NS } from "@ns";
import { getAllServers, Server, numberWithCommas } from "utils";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    let loop = true
    while (loop) {
        let servers = getAllServers(ns)
        let hosts = servers.filter((s) => (s.isRooted || s.canRoot) && s.maxRAM > 0)
        hosts.forEach((h) => { if (!h.isRooted) h.root() })
        let targets = servers.filter((s) => s.canHack)
        // ns.tprint("WARNING: Manually setting target")
        // targets = [new Server(ns, "iron-gym")]
        hosts.sort((a, b) => b.availableRAM - a.availableRAM)
        hosts.map((s) => { if (!ns.fileExists('weaken-target.js', s.name)) ns.scp(["hack-target.js", "grow-target.js", "weaken-target.js"], s.name, "home") })
        targets.sort((a, b) => b.maxMoney - a.maxMoney)

        await prepServer(ns, targets[0], hosts)
        // loop = false
        let batchTime = await scheduleBatch(ns, targets[0], hosts)
        await ns.sleep(batchTime + 1000)
    }

}

/**
 * Currently blocks until server is prepped.
 * @param ns NS
 * @param target server to prep
 * @param hosts host servers
 */
async function prepServer(ns: NS, target: Server, hosts: Server[]) {
    ns.print("Prepping " + target.name)
    if (!target.isRooted) target.root()
    let scriptMem = ns.getScriptRam('weaken-target.js')
    let weakenNeeded = target.security - target.minSecurity
    let weakenThreadsNeeded = 0
    while (ns.weakenAnalyze(weakenThreadsNeeded) < weakenNeeded) {
        weakenThreadsNeeded++
    }
    let growMultNeeded = target.maxMoney / Math.max(target.money, 1)
    let growThreadsNeeded = Math.ceil(ns.growthAnalyze(target.name, growMultNeeded))
    let weakenNeededAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsNeeded))
    let weakenThreadsNeededAfterGrow = 0
    while (ns.weakenAnalyze(weakenThreadsNeededAfterGrow) < weakenNeededAfterGrow) {
        weakenThreadsNeededAfterGrow++
    }

    ns.print(`${target.name} needs ${weakenThreadsNeeded} threads to fully weaken`)
    ns.print(`${target.name} needs ${growThreadsNeeded} threads to fully grow`)
    ns.print(`${target.name} needs ${weakenThreadsNeededAfterGrow} threads to weaken after grow`)

    // Weaken the target to minimum security
    let shouldSleep = false
    if (weakenThreadsNeeded > 0) {
        shouldSleep = true
        ns.print(`Using ${weakenThreadsNeeded} threads to weaken ${target.name}`)
    }
    while (weakenThreadsNeeded > 0) {
        for (let host of hosts) {
            let threads = Math.min(Math.floor(host.availableRAM / scriptMem), weakenThreadsNeeded)
            if (threads <= 0) {
                continue
            }
            ns.exec("weaken-target.js", host.name, {threads: threads, temporary: true}, target.name)
            weakenThreadsNeeded -= threads
        }
        if (weakenThreadsNeeded > 0) {
            await ns.sleep(target.weakenTime + 400)
        }
        await ns.sleep(200)
    }
    if (shouldSleep) await ns.sleep(400)

    // Grow the target to maximum money
    let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / scriptMem)), 0)
    let growSleepTime = target.weakenTime - target.growTime - 400
    let weakenSleepTime = target.growTime - target.weakenTime
    if (growThreadsNeeded <= 0) { }
    else if (totalThreadsAvailable >= growThreadsNeeded + weakenThreadsNeededAfterGrow) {
        ns.print('Running all at once')
        ns.print(`Using ${growThreadsNeeded + weakenThreadsNeededAfterGrow} of ${totalThreadsAvailable} threads to prep ${target.name}`)
        while (growThreadsNeeded > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / scriptMem), growThreadsNeeded)
                if (threads <= 0) {
                    continue
                }
                ns.exec("grow-target.js", host.name, {threads: threads, temporary: true}, target.name, growSleepTime)
                growThreadsNeeded -= threads
                if (growThreadsNeeded <= 0) {
                    break
                }
            }
            if (growThreadsNeeded > 0) {
                ns.print("ERROR: miscalculated threads available")
                await ns.sleep(200)
            }
        }
        while (weakenThreadsNeededAfterGrow > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / scriptMem), weakenThreadsNeededAfterGrow)
                if (threads <= 0) {
                    continue
                }
                ns.exec("weaken-target.js", host.name, {threads: threads, temporary: true}, target.name, weakenSleepTime)
                weakenThreadsNeededAfterGrow -= threads
                if (weakenThreadsNeededAfterGrow <= 0) {
                    break
                }
            }
            if (growThreadsNeeded > 0) {
                ns.print("ERROR: miscalculated threads available")
                await ns.sleep(200)
            }
        }
        ns.print(`Waiting ${(target.weakenTime / 1000).toFixed(2)} seconds`)
        await ns.sleep(Math.max(target.growTime, target.weakenTime) + 400)
    }
    else {
        ns.print('Running in batches')
        while (growThreadsNeeded > 0 && weakenThreadsNeededAfterGrow > 0) {
            let availableGrowThreads = Math.min(Math.floor(growThreadsNeeded * totalThreadsAvailable / (growThreadsNeeded + weakenThreadsNeededAfterGrow)), growThreadsNeeded)
            let availableWeakenThreads = Math.min(totalThreadsAvailable - availableGrowThreads, weakenThreadsNeededAfterGrow)
            ns.print(`Running ${availableGrowThreads + availableWeakenThreads} of ${growThreadsNeeded + weakenThreadsNeededAfterGrow} threads`)
            growThreadsNeeded -= availableGrowThreads
            weakenThreadsNeededAfterGrow -= availableWeakenThreads
            while (availableGrowThreads > 0) {
                for (let host of hosts) {
                    let threads = Math.min(Math.floor(host.availableRAM / scriptMem), availableGrowThreads)
                    if (threads <= 0) {
                        continue
                    }
                    ns.exec("grow-target.js", host.name, {threads: threads, temporary: true}, target.name, growSleepTime)
                    availableGrowThreads -= threads
                    if (availableGrowThreads <= 0) {
                        break
                    }
                }
                await ns.sleep(50)
            }
            while (availableWeakenThreads > 0) {
                for (let host of hosts) {
                    let threads = Math.min(Math.floor(host.availableRAM / scriptMem), availableWeakenThreads)
                    if (threads <= 0) {
                        continue
                    }
                    ns.exec("weaken-target.js", host.name, {threads: threads, temporary: true}, target.name, weakenSleepTime)
                    availableWeakenThreads -= threads
                    if (availableWeakenThreads <= 0) {
                        break
                    }
                }
                await ns.sleep(50)
            }
            await ns.sleep(Math.max(target.growTime, target.weakenTime) + 400)
        }

    }
    ns.print(`Finished prepping ${target.name}`)
}

// TODO: Change scheduling to use time instead of sleep
async function scheduleBatch(ns: NS, target: Server, hosts: Server[]) {
    ns.print(`Scheduling batch on ${target.name}`)
    let targetBatches = 100
    let scheduling = true
    let hackRatio = 0.75
    let scheduleBuffer = 2000
    let hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
    let weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 3)
    let growThreadsAfterHack = 3000 // Manually calculated, can be updated with Formulas api by uncommenting below code
    let tempTarget
    if (ns.fileExists("Formulas.exe")) {
        tempTarget = ns.getServer(target.name)
        tempTarget.moneyAvailable = target.maxMoney * (1 - hackRatio)
        growThreadsAfterHack = Math.ceil(ns.formulas.hacking.growThreads(tempTarget, ns.getPlayer(), target.maxMoney) * 3)
    }
    let weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)

    while (scheduling && hackRatio > 0.01) {
        targetBatches = 100
        let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / 1.75)), 0)

        hackThreads = Math.max(Math.floor(hackRatio / ns.hackAnalyze(target.name)), 1)
        weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 3)
        if (ns.fileExists("Formulas.exe")) {
            tempTarget = ns.getServer(target.name)
            tempTarget.moneyAvailable = target.maxMoney * (1 - hackRatio)
            growThreadsAfterHack = Math.ceil(ns.formulas.hacking.growThreads(tempTarget, ns.getPlayer(), target.maxMoney) * 3)
        }
        else {
            growThreadsAfterHack = Math.ceil(growThreadsAfterHack * 0.95)
        }
        weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)
        let totalThreadsNeeded = hackThreads + weakenThreadsAfterHack + growThreadsAfterHack + weakenThreadsAfterGrow
        targetBatches = Math.min(targetBatches, Math.floor(totalThreadsAvailable / totalThreadsNeeded))
        if (targetBatches < 1) {
            hackRatio -= 0.01
        }
        else {
            scheduling = false
        }
    }

    ns.print(`Hack ratio: ${hackRatio}`)
    ns.print(`Batches: ${targetBatches}`)

    if (hackRatio < 0.05) {
        ns.print("ERROR: Failed to schedule even a single batch")
        return 0
    }

    let firstWeakenDelay = scheduleBuffer
    let hackDelay = target.weakenTime - target.hackTime - scheduleBuffer + firstWeakenDelay
    let growDelay = firstWeakenDelay + target.weakenTime - target.growTime + scheduleBuffer
    let secondWeakenDelay = growDelay + target.growTime - target.weakenTime + scheduleBuffer
    let batchDelay = secondWeakenDelay + scheduleBuffer

    ns.print(`Using ${(hackThreads + weakenThreadsAfterHack + growThreadsAfterHack + weakenThreadsAfterGrow) * targetBatches} of ${hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / 1.75)), 0)} threads to run ${targetBatches} batches`)
    ns.print(`Stealing $${numberWithCommas(Math.round(target.maxMoney * hackRatio))} from ${target.name} every 4 seconds after a ${(hackDelay + target.hackTime) / 1000} second delay`)

    for (let i = 0; i < targetBatches; i++) {
        let batchHackDelay = hackDelay + batchDelay * i
        let batchFirstWeakDelay = firstWeakenDelay + batchDelay * i
        let batchGrowDelay = growDelay + batchDelay * i
        let batchSecondWeakDelay = secondWeakenDelay + batchDelay * i
        let batchHackThreads = hackThreads
        let batchFirstWeakenThreads = weakenThreadsAfterHack
        let batchGrowThreads = growThreadsAfterHack
        let batchSecondWeakenThreads = weakenThreadsAfterGrow

        while (batchHackThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.7), batchHackThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("hack-target.js", host.name, {threads: threads, temporary: true}, target.name, batchHackDelay, i)
                batchHackThreads -= threads
                if (batchHackThreads <= 0) {
                    break
                }
            }
        }
        while (batchFirstWeakenThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.75), batchFirstWeakenThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("weaken-target.js", host.name, {threads: threads, temporary: true}, target.name, batchFirstWeakDelay, i)
                batchFirstWeakenThreads -= threads
                if (batchFirstWeakenThreads <= 0) {
                    break
                }
            }
        }
        while (batchGrowThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.75), batchGrowThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("grow-target.js", host.name, {threads: threads, temporary: true}, target.name, batchGrowDelay, i)
                batchGrowThreads -= threads
                if (batchGrowThreads <= 0) {
                    break
                }
            }
            // await ns.sleep(200)
        }
        while (batchSecondWeakenThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.75), batchSecondWeakenThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("weaken-target.js", host.name, {threads: threads, temporary: true}, target.name, batchSecondWeakDelay, i)
                batchSecondWeakenThreads -= threads
                if (batchSecondWeakenThreads <= 0) {
                    break
                }
            }
        }
    }

    return secondWeakenDelay + target.weakenTime + (batchDelay * targetBatches) + scheduleBuffer
}