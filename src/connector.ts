import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    if (ns.args.length < 1) {
        ns.tprint("Target not provided")
        return
    }
    let target = ns.args[0].toString()
    let path = findPath(ns, "home", target, [], ["home"])
    if (path === undefined) {
        ns.tprint("Path not found")
        return
    }

    for (let s of path) {
        ns.singularity.connect(s)
    }

    /**
     * home -> target
     * scan home.
     * if target
     */
}

function findPath (ns: NS, curServer: string, target: string, path: string[], scanned: string[]): any {
    let servs = ns.scan(curServer)
    for (let s of servs) {
        if (s === target) {
            path.push(s)
            return path
        } 
        else if (!scanned.includes(s)){
            scanned.push(s)
            return findPath(ns, s, target, path.concat(s), scanned)
        }
    }
    return
}
