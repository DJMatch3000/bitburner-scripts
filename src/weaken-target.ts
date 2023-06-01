import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    if (ns.args.length < 1) {
        ns.print("ERROR: No weaken target given")
        return
    }

    let target: string = ns.args[0].toString()
    if (ns.args.length > 1 && typeof ns.args[1] === "number" && ns.args[1] > 0) {
        await ns.sleep(ns.args[1])
    }
    await ns.weaken(target)
}
 