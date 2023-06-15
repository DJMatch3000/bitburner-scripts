import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL')
    if (ns.args.length < 1) {
        ns.tprint("Target not provided")
        return
    }
    let target = ns.args[0].toString()
    let path = await findPath(ns, target)
    if (path === undefined) {
        ns.tprint("Path not found")
        return
    }
    ns.tprint(JSON.stringify(path))

    // for (let s of path) {
    //     ns.singularity.connect(s)
    // }
}

async function findPath (ns: NS, target: string) {
    let curServ = "home"
    let path = [curServ]
    let scanned = []
    while (curServ != target) {
        scanned.push(curServ)
        for (let s of ns.scan(curServ)) {
            
        }
    }
}
