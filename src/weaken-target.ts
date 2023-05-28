import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    if (ns.args.length < 1) {
        ns.print("ERROR: No weaken target given")
        return
    }

    let target: string = ns.args[0].toString()
    await ns.weaken(target)
}
 