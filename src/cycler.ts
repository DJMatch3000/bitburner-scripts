import { NS } from "@ns";
import { getAllServers, Server, getMults } from "utils";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    let loop = true
    while (loop) {
        let servers = getAllServers(ns)
        let hosts = servers.filter((s) => s.isRooted)
        let targets = servers.filter((s) => s.canHack)
        // ns.tprint("WARNING: Manually setting target")
        // targets = [new Server(ns, "iron-gym")]
        hosts.sort((a, b) => b.availableRAM - a.availableRAM)
        hosts.map((s) => {if (!ns.fileExists('weaken-target.js', s.name)) ns.scp(["hack-target.js", "grow-target.js", "weaken-target.js"], s.name, "home")})
        targets.sort((a, b) => b.maxMoney - a.maxMoney)

        await prepServer(ns, targets[0], hosts)
        // loop = false
        let batchTime = await scheduleBatch(ns, targets[0], hosts)
        await ns.sleep(batchTime + 1000) 
    }
    
}

/**
 * Currently blocks until server is prepped.
 * TODO: Unblock and account for changes to hosts
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
    let growMultNeeded = target.maxMoney / target.money
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
            ns.exec("weaken-target.js", host.name, threads, target.name)
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
    if (growThreadsNeeded <= 0) {}
    else if (totalThreadsAvailable >= growThreadsNeeded + weakenThreadsNeededAfterGrow) {
        ns.print('Running all at once')
        ns.print(`Using ${growThreadsNeeded + weakenThreadsNeededAfterGrow} of ${totalThreadsAvailable} threads to grow ${target.name}`)
        while (growThreadsNeeded > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / scriptMem), growThreadsNeeded)
                if (threads <= 0) {
                    continue
                }
                ns.exec("grow-target.js", host.name, threads, target.name, growSleepTime)
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
                ns.exec("weaken-target.js", host.name, threads, target.name, weakenSleepTime)
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
        await ns.sleep(Math.max(target.growTime, target.weakenTime) + 400)
    }
    else {
        ns.print('Running in batches')
        while (growThreadsNeeded > 0 && weakenThreadsNeededAfterGrow > 0) {
            let availableGrowThreads = Math.floor(growThreadsNeeded * totalThreadsAvailable / (growThreadsNeeded + weakenThreadsNeededAfterGrow))
            let availableWeakenThreads = totalThreadsAvailable - availableGrowThreads
            growThreadsNeeded -= availableGrowThreads
            weakenThreadsNeededAfterGrow -= availableWeakenThreads
            while (availableGrowThreads > 0) {
                for (let host of hosts) {
                    let threads = Math.min(Math.floor(host.availableRAM / scriptMem), availableGrowThreads)
                    if (threads <= 0) {
                        continue
                    }
                    ns.exec("grow-target.js", host.name, threads, target.name, growSleepTime)
                    availableGrowThreads -= threads
                    if (availableGrowThreads <= 0) {
                        break
                    }
                }
            }
            while (availableWeakenThreads > 0) {
                for (let host of hosts) {
                    let threads = Math.min(Math.floor(host.availableRAM / scriptMem), availableWeakenThreads)
                    if (threads <= 0) {
                        continue
                    }
                    ns.exec("weaken-target.js", host.name, threads, target.name, weakenSleepTime)
                    availableWeakenThreads -= threads
                    if (availableWeakenThreads <= 0) {
                        break
                    }
                }
            }
            await ns.sleep(Math.max(target.growTime, target.weakenTime) + 400)
        }

    }
    ns.print(`Finished prepping ${target.name}`)
}

async function scheduleBatch(ns: NS, target: Server, hosts: Server[]) {
    ns.print(`Scheduling batch on ${target.name}`)
    let targetBatches = 10
    let scheduling = true
    let hackRatio = 0.97
    let hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
    let weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 1.25)
    let growThreadsAfterHack = 3000 // Manually calculated, can be updated with Formulas api by uncommenting below code
    let tempTarget = ns.getServer(target.name)
    // @ts-ignore
    tempTarget.moneyAvailable *= (1 - hackRatio)
    growThreadsAfterHack = ns.formulas.hacking.growThreads(tempTarget, ns.getPlayer(), target.maxMoney)
    let weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)

    while (scheduling && targetBatches > 0) {
        hackRatio = 0.97
        let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / 1.75)), 0)
        let batchThreadsAvailable = Math.floor(totalThreadsAvailable / targetBatches)
        while (hackThreads + weakenThreadsAfterHack + growThreadsAfterHack + weakenThreadsAfterGrow > batchThreadsAvailable && hackRatio > 0) {
            hackRatio -= 0.01
            hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
            weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 1.25)

            // growThreadsAfterHack = Math.ceil(growThreadsAfterHack * 0.95)
            tempTarget = ns.getServer(target.name)
            // @ts-ignore
            tempTarget.moneyAvailable *= (1 - hackRatio)
            growThreadsAfterHack = ns.formulas.hacking.growThreads(tempTarget, ns.getPlayer(), target.maxMoney)

            weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)
        }
        if (hackRatio <= 0) {
            targetBatches--
        }
        else {
            scheduling = false
        }
    }

    if (targetBatches <= 0) {
        ns.print("ERROR: Failed to schedule even a single batch")
        return 0
    }

    let firstWeakenDelay = 0
    let hackDelay = target.weakenTime - target.hackTime - 1000 + firstWeakenDelay
    let growDelay = firstWeakenDelay + target.weakenTime - target.growTime + 1000
    let secondWeakenDelay = growDelay + target.growTime - target.weakenTime + 1000
    let batchDelay = secondWeakenDelay + 1000
    
    // ns.print(`Hack: ${hackThreads} threads after ${Math.round(hackDelay / 10) / 100} seconds`)
    // ns.print(`First Weaken: ${weakenThreadsAfterHack} threads after ${Math.round(firstWeakenDelay / 10) / 100} seconds`)
    // ns.print(`Grow: ${growThreadsAfterHack} threads after ${Math.round(growDelay / 10) / 100} seconds`)
    // ns.print(`Second Weaken: ${weakenThreadsAfterGrow} threads after ${Math.round(secondWeakenDelay / 10) / 100} seconds`)
    ns.print(`Using ${(hackThreads + weakenThreadsAfterHack + growThreadsAfterHack + weakenThreadsAfterGrow) * targetBatches} of ${hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / 1.75)), 0)} threads to run ${targetBatches} batches`)
    ns.print(`Stealing $${Math.round(target.maxMoney * hackRatio * 100) / 100} from ${target.name} every 4 seconds after a ${(hackDelay + target.hackTime) / 1000} second delay`)

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
                ns.exec("hack-target.js", host.name, threads, target.name, batchHackDelay, i)
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
                ns.exec("weaken-target.js", host.name, threads, target.name, batchFirstWeakDelay, i)
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
                ns.exec("grow-target.js", host.name, threads, target.name, batchGrowDelay, i)
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
                ns.exec("weaken-target.js", host.name, threads, target.name, batchSecondWeakDelay, i)
                batchSecondWeakenThreads -= threads
                if (batchSecondWeakenThreads <= 0) {
                    break
                }
            }
        }
    }
    
    return secondWeakenDelay + target.weakenTime + (batchDelay * targetBatches)
}