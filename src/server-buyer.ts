import { NS } from "@ns";
import { numberWithCommas } from "utils";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    const HOSTNAME = "daemonhost-"

    for (let i = ns.getPurchasedServers().length; i < ns.getPurchasedServerLimit(); i++) {
        let serverRam = Math.min(ns.getServerMaxRam("home"), ns.getPurchasedServerMaxRam())
        ns.print(`Server cost: $${numberWithCommas(ns.getPurchasedServerCost(serverRam))}`)
        while (ns.getServerMoneyAvailable("home") < ns.getPurchasedServerCost(serverRam)) {
            await ns.sleep(200)
        }
        ns.print("Purchasing server " + HOSTNAME + i.toString())
        ns.purchaseServer(HOSTNAME + i.toString(), serverRam)
    }
}
