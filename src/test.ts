import { NS } from "@ns";
import { Server } from "utils"
// import { scheduleBatch } from "cycler";

export async function main(ns: NS): Promise<void> {
    // let target = new Server(ns, "omega-net")
    // let threads = Math.floor(ns.hackAnalyzeThreads(target.name, target.money * 0.75))
    // let hosts = [new Server(ns, "daemonhost-0"), new Server(ns, "daemonhost-1")]
    // let maxThreads = Math.floor(ns.getServerMaxRam(hosts[0].name) / 1.75)
    // ns.exec("hack-target.js", hosts[0].name, maxThreads, target.name)
    // ns.exec("hack-target.js", hosts[1].name, threads - maxThreads, target.name)
    // await ns.weaken("omega-net")
    // ns.tprint(ns.growthAnalyze("omega-net", 4.1))
    // scheduleBatch(ns, new Server(ns, "omega-net"), [])
}
