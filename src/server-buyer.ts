import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    const HOSTNAME = "daemonhost"

    for (let i = ns.getPurchasedServers().length; i < ns.getPurchasedServerLimit(); i++) {
        let serverRam = ns.getServerMaxRam("home")
        while (ns.getServerMoneyAvailable("home") < ns.getPurchasedServerCost(serverRam)) {
            await ns.sleep(200)
        }
        ns.print("Purchasing server " + HOSTNAME + i.toString())
        ns.purchaseServer(HOSTNAME + i.toString(), serverRam)
    }
}
