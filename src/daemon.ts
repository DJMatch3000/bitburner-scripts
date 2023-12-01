import { NS } from "@ns";
// import {programBuyer} from "programctl"
// import { cycler } from "cycler";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('sleep')
    /*
    still need to:
    buy more RAM
    join factions
    purchase augs and reset

    may want to consider using import/export instead of separate processes to conserve RAM
    at the cost of a much larger daemon (likely impossible due to concurrent call restrictions)
    */
    const SCRIPTS = [{name: 'cycler.js', port: 1}, {name: 'server-buyer.js', port: 2}, {name: 'programctl.js', port: 3}]

    // let functions = [cycler, programBuyer, serverBuyer]

    while (true) { 
        for (let s of SCRIPTS) {
            if (!ns.isRunning(s.name) && ns.readPort(s.port) !== "Done") {
                ns.run(s.name)
            }
        }
        await ns.sleep(100)
    }
}
