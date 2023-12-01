import { NS } from "@ns";
import { getAllServers, Server, numberWithCommas } from "utils";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    await cycler(ns)
}

export async function cycler(ns: NS) {
    let loop = true
    while (loop) {
        let servers = getAllServers(ns)
        let hosts = servers.filter((s) => (s.isRooted || s.canRoot) && s.maxRAM > 0)
        hosts.forEach((h) => { if (!h.isRooted) h.root() })
        let targets = servers.filter((s) => s.canHack)
        // ns.tprint("WARNING: Manually setting target")
        // targets = [new Server(ns, "iron-gym")]
        hosts.sort((a, b) => b.availableRAM - a.availableRAM)
        hosts.map((s) => { if (!ns.fileExists('weaken-target-new.js', s.name)) ns.scp(["hack-target-new.js", "grow-target-new.js", "weaken-target-new.js"], s.name, "home") })

        let totalRAM = hosts.reduce((ram, h) => (ram + h.maxRAM), 0)
        targets.sort((a, b) => {
            // +maxMoney, -minSec, +growrate, minSec means less as hackLevel grows, growrate means less as RAM grows
            // (money ^ x) * (growth ^ RAM/(RAM + y)) * (minSec ^ (hack/(hack + z))
            let moneyCoeff = (x: Server) => Math.pow(x.maxMoney * 0.001, (totalRAM / (totalRAM + 1000)))
            let growCoeff = (x: Server) => (Math.pow(Math.min(ns.getServerGrowth(x.name), 100), 1.5))
            let secCoeff = (x: Server) => (Math.pow(x.minSecurity, (ns.getHackingLevel() / (ns.getHackingLevel() + 1000))))
            let scoreA = (moneyCoeff(a) * growCoeff(a) / secCoeff(a))
            let scoreB = (moneyCoeff(b) * growCoeff(b) / secCoeff(b))
            
            return scoreA - scoreB
        })

        // ns.tprint(targets.map((s) => s.name))

        let batchTime = 0
        while (batchTime <= 0 && targets.length > 0) {
            let target = targets.pop()
            if (target == undefined) {
                break
            }
            await prepServer(ns, target, hosts)
            batchTime = await scheduleBatch(ns, target, hosts)
        }
        await ns.asleep(batchTime + 1000)
    }
}

/**
 * Currently blocks until server is prepped.
 * @param ns NS
 * @param target server to prep
 * @param hosts host servers
 */
async function prepServer(ns: NS, target: Server | undefined, hosts: Server[]) {
    if (target === undefined) {
        ns.tprint('ERROR: No valid targets')
        ns.exit()
    }
    ns.print("Prepping " + target.name)
    if (!target.isRooted) target.root()
    let scriptMem = ns.getScriptRam('weaken-target.js')

    let weakenNeeded = target.security - target.minSecurity
    let weakenThreadsNeeded = 0
    while (ns.weakenAnalyze(weakenThreadsNeeded) < weakenNeeded) {
        weakenThreadsNeeded++
    }
    let growMultNeeded = target.maxMoney / Math.max(target.money, 1)
    let growThreadsNeeded = 0
    let weakenNeededAfterGrow = 0
    let weakenThreadsNeededAfterGrow = 0
    if (growMultNeeded > 0) {
        growThreadsNeeded = Math.ceil(ns.growthAnalyze(target.name, growMultNeeded))
        weakenNeededAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsNeeded))
        while (ns.weakenAnalyze(weakenThreadsNeededAfterGrow) < weakenNeededAfterGrow) {
            weakenThreadsNeededAfterGrow++
        }
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
            ns.exec("weaken-target-new.js", host.name, {threads: threads, temporary: true}, target.name)
            weakenThreadsNeeded -= threads
        }
        if (weakenThreadsNeeded > 0) {
            await ns.asleep(target.weakenTime + 400)
        }
        await ns.asleep(200)
    }
    if (shouldSleep) await ns.asleep(400)

    // Grow the target to maximum money
    let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / scriptMem)), 0)
    let growSleepTime = Date.now() + target.weakenTime - target.growTime - 400
    let weakenSleepTime = Date.now() + target.growTime - target.weakenTime
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
                ns.exec("grow-target-new.js", host.name, {threads: threads, temporary: true}, target.name, growSleepTime)
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
                ns.exec("weaken-target-new.js", host.name, {threads: threads, temporary: true}, target.name, weakenSleepTime)
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
        ns.print(`Waiting ${((target.weakenTime) / 1000).toFixed(2)} seconds`)
        await ns.asleep(Math.max(target.growTime, target.weakenTime) + 400)
    }
    else {
        ns.print('Running in batches')
        while (growThreadsNeeded > 0 && weakenThreadsNeededAfterGrow > 0) {
            growMultNeeded = target.maxMoney / Math.max(target.money, 1)
            growThreadsNeeded = Math.ceil(ns.growthAnalyze(target.name, growMultNeeded))
            weakenNeededAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsNeeded))
            weakenThreadsNeededAfterGrow = 0
            while (ns.weakenAnalyze(weakenThreadsNeededAfterGrow) < weakenNeededAfterGrow) {
                weakenThreadsNeededAfterGrow++
            }

            totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / scriptMem)), 0)
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
                    ns.exec("grow-target-new.js", host.name, {threads: threads, temporary: true}, target.name, growSleepTime)
                    availableGrowThreads -= threads
                    if (availableGrowThreads <= 0) {
                        break
                    }
                }
                await ns.asleep(50)
            }
            while (availableWeakenThreads > 0) {
                for (let host of hosts) {
                    let threads = Math.min(Math.floor(host.availableRAM / scriptMem), availableWeakenThreads)
                    if (threads <= 0) {
                        continue
                    }
                    ns.exec("weaken-target-new.js", host.name, {threads: threads, temporary: true}, target.name, weakenSleepTime)
                    availableWeakenThreads -= threads
                    if (availableWeakenThreads <= 0) {
                        break
                    }
                }
                await ns.asleep(50)
            }
            await ns.asleep(Math.max(target.growTime, target.weakenTime) + 400)
        }

    }
    ns.print(`Finished prepping ${target.name}`)
}

// TODO: Change scheduling to use time instead of sleep
async function scheduleBatch(ns: NS, target: Server | undefined, hosts: Server[]) {
    if (target === undefined) {
        return 0
    }
    ns.print(`Scheduling batch on ${target.name}`)
    let maxBatches = 100
    let targetBatches = maxBatches
    let scheduling = true
    let hackRatio = 0.75
    let scheduleBuffer = 500
    let hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
    let weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 3)
    let growThreadsAfterHack = 3000
    let tempTarget
    if (ns.fileExists("Formulas.exe")) {
        tempTarget = ns.getServer(target.name)
        tempTarget.moneyAvailable = target.maxMoney * (1 - hackRatio)
        growThreadsAfterHack = Math.ceil(ns.formulas.hacking.growThreads(tempTarget, ns.getPlayer(), target.maxMoney) * 3)
    }
    let weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)

    while (scheduling && hackRatio > 0.01) {
        targetBatches = maxBatches
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

    ns.print(`Hack ratio: ${hackRatio.toFixed(2)}`)
    ns.print(`Batches: ${targetBatches}`)

    if (hackRatio < 0.01) {
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

        let startTime = Date.now()

        while (batchHackThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.7), batchHackThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("hack-target-new.js", host.name, {threads: threads, temporary: true}, target.name, batchHackDelay + startTime, i)
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
                ns.exec("weaken-target-new.js", host.name, {threads: threads, temporary: true}, target.name, batchFirstWeakDelay + startTime, i)
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
                ns.exec("grow-target-new.js", host.name, {threads: threads, temporary: true}, target.name, batchGrowDelay + startTime, i)
                batchGrowThreads -= threads
                if (batchGrowThreads <= 0) {
                    break
                }
            }
        }
        while (batchSecondWeakenThreads > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / 1.75), batchSecondWeakenThreads)
                if (threads <= 0) {
                    continue
                }
                ns.exec("weaken-target-new.js", host.name, {threads: threads, temporary: true}, target.name, batchSecondWeakDelay + startTime, i)
                batchSecondWeakenThreads -= threads
                if (batchSecondWeakenThreads <= 0) {
                    break
                }
            }
        }
    }

    return secondWeakenDelay + target.weakenTime + (batchDelay * targetBatches) + scheduleBuffer
}