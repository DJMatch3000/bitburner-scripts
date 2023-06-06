import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    if (ns.args.length < 1) {
        ns.print("ERROR: No hack target given")
        return
    }

    let target: string = ns.args[0].toString()
    if (ns.args.length > 1) {
        await ns.sleep(Number.parseInt(ns.args[1].toString()))
    }
    await ns.hack(target)
} 
