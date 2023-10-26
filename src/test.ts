import { NS } from "@ns";
import { Server, getAllServers } from "utils"
import * as utils from "utils"

export async function main(ns: NS): Promise<void> {
    let servers = getAllServers(ns)
    let hosts = servers.filter((s) => (s.isRooted || s.canRoot) && s.maxRAM > 0)
    hosts.forEach((h) => { if (!h.isRooted) h.root() })
    let targets = servers.filter((s) => s.canHack)
    // ns.tprint("WARNING: Manually setting target")
    // targets = [new Server(ns, "iron-gym")]
    hosts.sort((a, b) => b.availableRAM - a.availableRAM)
    hosts.map((s) => { if (!ns.fileExists('weaken-target.js', s.name)) ns.scp(["hack-target.js", "grow-target.js", "weaken-target.js"], s.name, "home") })
    let totalRAM = hosts.reduce((ram, h) => (ram + h.maxRAM), 0)
    // totalRAM = 4e3
    let hackLevel = 1000

    let moneyCoeff = (x: Server) => Math.pow(x.maxMoney * 0.001, (totalRAM / (totalRAM + 1000)))
    let growCoeff = (x: Server) => (Math.pow(Math.min(ns.getServerGrowth(x.name), 100), 1.5))
    let secCoeff = (x: Server) => (Math.pow(x.minSecurity, (hackLevel / (hackLevel + 1000))))

    targets.sort((a, b) => {
        let scoreA = (moneyCoeff(a) * growCoeff(a) / secCoeff(a))
        let scoreB = (moneyCoeff(b) * growCoeff(b) / secCoeff(b))
        // let scoreA = growCoeff(a)
        // let scoreB = growCoeff(b)
        
        return scoreA - scoreB
    })

    for (let x of targets) {
        ns.tprint(`${x.name} score: ${moneyCoeff(x).toFixed(2)} money * ${growCoeff(x).toFixed(2)} growth/RAM / ${secCoeff(x).toFixed(2)} sec/level = ${(moneyCoeff(x) * growCoeff(x) / secCoeff(x)).toFixed(2)}`)
    }
    // ns.tprint(ns.getServerGrowth("alpha-ent"))
}
