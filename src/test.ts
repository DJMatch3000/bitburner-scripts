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

    let target = new Server(ns, "joesguns")
    let weakenNeeded = target.security - target.minSecurity
    let weakenThreadsNeeded = 0
    while (ns.weakenAnalyze(weakenThreadsNeeded) < weakenNeeded) {
        weakenThreadsNeeded++
    }
    let growMultNeeded = target.maxMoney / target.money
    let growThreadsNeeded = ns.growthAnalyze(target.name, growMultNeeded)
    let weakenNeededAfterGrow = ns.growthAnalyzeSecurity(growThreadsNeeded)
    let weakenThreadsNeededAfterGrow = 0
    while (ns.weakenAnalyze(weakenThreadsNeededAfterGrow) < weakenNeededAfterGrow) {
        weakenThreadsNeededAfterGrow++
    }

    ns.print(`${target.name} needs ${weakenThreadsNeeded} threads to fully weaken`)
    ns.print(`${target.name} needs ${growThreadsNeeded} threads to fully grow`)
    ns.print(`${target.name} needs ${weakenThreadsNeededAfterGrow} threads to weaken after grow`)

    let servers = getAllServers(ns)
    let hosts = servers.filter((s) => s.isRooted)
    let targets = servers.filter((s) => s.canHack)
    hosts.sort((a, b) => b.availableRAM - a.availableRAM)
    hosts.map((s) => {if (!ns.fileExists('weaken-target.js', s.name)) ns.scp(["hack-target.js", "grow-target.js", "weaken-target.js"], s.name, "home")})
    targets.sort((a, b) => b.maxMoney - a.maxMoney)
}

async function prepServer(ns: NS, target: Server, hosts: Server[]) {
    let scriptMem = ns.getScriptRam('weaken-target.js')
    let weakenNeeded = target.security - target.minSecurity
    let weakenThreadsNeeded = 0
    while (ns.weakenAnalyze(weakenThreadsNeeded) < weakenNeeded) {
        weakenThreadsNeeded++
    }
    let growMultNeeded = target.maxMoney / target.money
    let growThreadsNeeded = ns.growthAnalyze(target.name, growMultNeeded)
    let weakenNeededAfterGrow = ns.growthAnalyzeSecurity(growThreadsNeeded)
    let weakenThreadsNeededAfterGrow = 0
    while (ns.weakenAnalyze(weakenThreadsNeededAfterGrow) < weakenNeededAfterGrow) {
        weakenThreadsNeededAfterGrow++
    }

    ns.print(`${target.name} needs ${weakenThreadsNeeded} threads to fully weaken`)
    ns.print(`${target.name} needs ${growThreadsNeeded} threads to fully grow`)
    ns.print(`${target.name} needs ${weakenThreadsNeededAfterGrow} threads to weaken after grow`)

    // Weaken the target to minimum security
    while (weakenThreadsNeeded > 0) {
        for (let host of hosts) {
            let threads = Math.min(Math.floor(host.availableRAM / scriptMem), weakenThreadsNeeded)
            ns.exec("weaken-target.js", host.name, threads, target.name)
            weakenThreadsNeeded -= threads
        }
        if (weakenThreadsNeeded > 0) {
            await ns.sleep(target.weakenTime)
        }
        await ns.sleep(25)
    }

    // Grow the target to maximum money
    let totalThreadsAvailable = hosts.reduce((acc, host) => (acc + Math.floor(host.availableRAM / scriptMem)), 0)
    if (totalThreadsAvailable >= growThreadsNeeded + weakenThreadsNeededAfterGrow) {
        while (growThreadsNeeded > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / scriptMem), growThreadsNeeded)
                ns.exec("grow-target.js", host.name, threads, target.name)
                growThreadsNeeded -= threads
            }
            await ns.sleep(25)
        }
        while (weakenThreadsNeededAfterGrow > 0) {
            for (let host of hosts) {
                let threads = Math.min(Math.floor(host.availableRAM / scriptMem), weakenThreadsNeeded)
                ns.exec("weaken-target.js", host.name, threads, target.name)
                weakenThreadsNeeded -= threads
            }
        }
    }
}