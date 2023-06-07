import { NS } from "@ns";
import { Server, getAllServers } from "utils"
// import { scheduleBatch } from "cycler";

export async function main(ns: NS): Promise<void> {
    let x = ns.getPlayer().mults
    let s = getAllServers(ns)[0]
    ns.print(s.hackTime / x.hacking_speed)
    ns.hack(s.name)
    
}
