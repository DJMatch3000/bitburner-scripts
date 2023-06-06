import { NS } from "@ns";
import { getAllServers, Server } from "utils";

export async function main(ns: NS): Promise<void> {
    // single cycle
    // get threads to fully weaken and run
    // get threads to fully grow and run
    // repeat above until prepped

    // get threads to hack 95% of money
    // get threads to weaken after hack
    // get threads to grow after hack
    // get threads to weaken after grow
    // run all of the above
    ns.disableLog('ALL')
    ns.enableLog('sleep')
    let loop = true
    while (loop) {
        let servers = getAllServers(ns)
        let hosts = servers.filter((s) => s.isRooted)
        let targets = servers.filter((s) => s.canHack)
        // ns.tprint(targets.length)
        hosts.sort((a, b) => b.availableRAM - a.availableRAM)
        hosts.map((s) => {if (!ns.fileExists('weaken-target.js', s.name)) ns.scp(["hack-target.js", "grow-target.js", "weaken-target.js"], s.name, "home")})
        targets.sort((a, b) => b.maxMoney - a.maxMoney)
        // ns.tprint(targets[0].name)

        await prepServer(ns, targets[0], hosts)
        // loop = false
        let batchTime = await scheduleBatch(ns, targets[0], hosts)
        await ns.sleep(batchTime + 400) 
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
    let weakenNeededAfterGrow = ns.growthAnalyzeSecurity(growThreadsNeeded)
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
    ns.print('Beginning grow prep')
    if (growThreadsNeeded <= 0) {
        ns.print('No grow prep needed')
        
    }
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
    let hackRatio = 0.75
    let hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
    let weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 1.25)
    let growThreadsAfterHack = 3000 // Manually calculated, can be updated with Formulas api
    let weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)
    let firstWeakenDelay = 0
    let hackDelay = target.weakenTime - target.hackTime - 1000 + firstWeakenDelay
    let growDelay = firstWeakenDelay + target.weakenTime - target.growTime + 1000
    let secondWeakenDelay = growDelay + target.growTime - target.weakenTime + 1000

    let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / 1.75)), 0)
    while (hackThreads + weakenThreadsAfterHack + growThreadsAfterHack + weakenThreadsAfterGrow > totalThreadsAvailable) {
        hackRatio -= 0.01
        hackThreads = Math.floor(hackRatio / ns.hackAnalyze(target.name))
        weakenThreadsAfterHack = Math.ceil(ns.hackAnalyzeSecurity(hackThreads, target.name) / ns.weakenAnalyze(1) * 1.25)
        growThreadsAfterHack *= 0.9
        weakenThreadsAfterGrow = Math.ceil(ns.growthAnalyzeSecurity(growThreadsAfterHack) / ns.weakenAnalyze(1) * 1.25)
    }
    
    ns.print(`Hack: ${hackThreads} threads after ${Math.round(hackDelay / 10) / 100} seconds`)
    ns.print(`First Weaken: ${weakenThreadsAfterHack} threads after ${Math.round(firstWeakenDelay / 10) / 100} seconds`)
    ns.print(`Grow: ${growThreadsAfterHack} threads after ${Math.round(growDelay / 10) / 100} seconds`)
    ns.print(`Second Weaken: ${weakenThreadsAfterGrow} threads after ${Math.round(secondWeakenDelay / 10) / 100} seconds`)
    while (weakenThreadsAfterHack > 0) {
        for (let host of hosts) {
            let threads = Math.min(Math.floor(host.availableRAM / 1.75), weakenThreadsAfterHack)
            if (threads <= 0) {
                continue
            }
            ns.exec("weaken-target.js", host.name, threads, target.name, firstWeakenDelay)
            weakenThreadsAfterHack -= threads
            if (weakenThreadsAfterHack <= 0) {
                break
            }
        }
    }
    while (hackThreads > 0) {
        for (let host of hosts) {
            let threads = Math.min(Math.floor(host.availableRAM / 1.7), hackThreads)
            if (threads <= 0) {
                continue
            }
            ns.exec("hack-target.js", host.name, threads, target.name, hackDelay)
            hackThreads -= threads
            if (hackThreads <= 0) {
                break
            }
        }
    }
    while (growThreadsAfterHack > 0) {
        for (let host of hosts) {
            ns.print(`${growThreadsAfterHack} threads remaining`)
            let threads = Math.min(Math.floor(host.availableRAM / 1.75), growThreadsAfterHack)
            if (threads <= 0) {
                continue
            }
            ns.exec("grow-target.js", host.name, threads, target.name, growDelay)
            growThreadsAfterHack -= threads
            if (growThreadsAfterHack <= 0) {
                break
            }
        }
        // await ns.sleep(200)
    }
    while (weakenThreadsAfterGrow > 0) {
        for (let host of hosts) {
            let threads = Math.min(Math.floor(host.availableRAM / 1.75), weakenThreadsAfterGrow)
            if (threads <= 0) {
                continue
            }
            ns.exec("weaken-target.js", host.name, threads, target.name, secondWeakenDelay)
            weakenThreadsAfterGrow -= threads
            if (weakenThreadsAfterGrow <= 0) {
                break
            }
        }
    }
    return secondWeakenDelay + target.weakenTime
}