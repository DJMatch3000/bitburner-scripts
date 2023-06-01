import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    if (ns.args.length < 1) {
        ns.print("ERROR: No weaken target given")
        return
    }

    let target: string = ns.args[0].toString()
    if (ns.args.length > 1 && typeof ns.args[1] === "number") {
        await ns.sleep(ns.args[1])
    }
    await ns.weaken(target)
}
 