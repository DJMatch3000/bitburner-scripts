import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    memoryBuyer(ns)
}

async function memoryBuyer(ns: NS): Promise<void> {
    while (true) {
        let money = ns.getServerMoneyAvailable("home")
        if (money >= ns.singularity.getUpgradeHomeRamCost()) {
            ns.singularity.upgradeHomeRam()
        }
        await ns.asleep(200)
    }
}