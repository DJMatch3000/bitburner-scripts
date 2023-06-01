import { NS } from "@ns";
import { getAllServers, Server } from "utils";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    while (true) {
        await scheduler(ns)
        await ns.sleep(200)
    }
}

async function scheduler(ns: NS) {
    const HACK_RAM = ns.getScriptRam("hack-target.js") // 1.7GB
    const GROW_RAM = ns.getScriptRam("grow-target.js") // 1.75GB
    const WEAKEN_RAM = ns.getScriptRam("weaken-target.js") // 1.75GB

    // Get list of hosts and available RAM
    let hosts = getAllServers(ns).filter((s) => s.canRoot || s.isRooted)
    let totalRAM = 0
    for (let h of hosts) {
        if(h.name != "home" && !h.isRooted) {
            ns.print("Rooting " + h.name)
            h.root()
        }
        if (!ns.fileExists("hack-target.js", h.name)) {
            ns.scp("hack-target.js", h.name, "home")
        }
        if (!ns.fileExists("grow-target.js", h.name)) {
            ns.scp("grow-target.js", h.name, "home")
        }
        if (!ns.fileExists("weaken-target.js", h.name)) {
            ns.scp("weaken-target.js", h.name, "home")
        }
        totalRAM += h.availableRAM
    }

    let target = getTarget(ns, undefined)
    ns.print("Target is " + target.name)
    if (target.security > target.minSecurity) {
        ns.print(`Weakening ${target.name}`)
        for (let h of hosts) {
            let numThreads = Math.floor(h.availableRAM / WEAKEN_RAM)
            if (numThreads > 0) {
                ns.exec("weaken-target.js", h.name, numThreads, target.name)
            }
        }
        ns.print(`Waiting ${(target.weakenTime + 200) / 1000} seconds`)
        await ns.sleep(target.weakenTime + 200)
    }
    else if (target.money < target.maxMoney) {
        ns.print(`Growing ${target.name}`)
        for (let h of hosts) {
            let numThreads = Math.floor(h.availableRAM / GROW_RAM)
            if (numThreads > 0) {
                ns.exec("grow-target.js", h.name, numThreads, target.name)
            }
        }
        ns.print(`Waiting ${(target.growTime + 200) / 1000} seconds`)
        await ns.sleep(target.growTime + 200)
    }
    else {
        ns.print(`Hacking ${target.name}`)
        for (let h of hosts) {
            let numThreads = Math.floor(h.availableRAM / HACK_RAM)
            if (numThreads > 0) {
                ns.exec("hack-target.js", h.name, numThreads, target.name)
            }
        }
        ns.print(`Waiting ${(target.hackTime + 200) / 1000} seconds`)
        await ns.sleep(target.hackTime + 200)
    }
}

function getTarget(ns: NS, curTarget: Server | undefined): Server {
    let servs = getAllServers(ns)
    let newTarget = curTarget
    if (curTarget === undefined) {
        newTarget = servs.find((s) => s.canHack)
    }
    if (newTarget === undefined) {
        ns.tprint("ERROR: No hackable targets found")
        ns.exit()
    }
    for (let s of servs) {
        if (s.canHack && s.maxMoney > newTarget.maxMoney) {
            newTarget = s
        }
    }
    if (!newTarget.isRooted) {
        newTarget.root()
    }
    return newTarget
}