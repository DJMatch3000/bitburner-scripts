import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
    ns.tprint("This is where all utility functions are")
}

export function getAllServers(ns: NS): Server[] {
    let toScan = ["home"]
    let scanned: string[] = []

    while (toScan.length > 0) {
        let server = toScan.pop()
        if (server === undefined) {
            break
        }
        for (let s of ns.scan(server)) {
            if (!scanned.includes(s)) {
                toScan.push(s)
            }
        }
        scanned.push(server)
    }

    return scanned.map((s) => new Server(ns, s))
}

export class Server {
    ns: NS
    name: string

    constructor(ns: NS, serverName: string) {
        this.ns = ns
        this.name = serverName
    }

    //Host-related properties
    get portsNeeded() {
        return this.ns.getServerNumPortsRequired(this.name)
    }

    get isRooted() {
        return this.ns.hasRootAccess(this.name)
    }

    get canRoot() {
        let numCracks = 0
        if (this.ns.fileExists("BruteSSH.exe")) numCracks++
        if (this.ns.fileExists("FTPCrack.exe")) numCracks++
        if (this.ns.fileExists("relaySMTP.exe")) numCracks++
        if (this.ns.fileExists("httpWorm.exe")) numCracks++
        if (this.ns.fileExists("SQLInject.exe")) numCracks++

        return numCracks >= this.portsNeeded
    }

    get maxRAM() {
        if (this.name === "home") {
            return Math.floor(this.ns.getServerMaxRam(this.name) * 0.8)
        }
        return this.ns.getServerMaxRam(this.name)
    }

    get usedRAM() {
        return this.ns.getServerUsedRam(this.name)
    }

    get availableRAM() {
        if (this.name === "home") {
            return Math.floor((this.maxRAM - this.usedRAM) * 0.8 * 100) / 100
        }
        return Math.max(this.maxRAM - this.usedRAM, 0)
    }


    //Target-related properties
    get canHack() {
        return this.ns.getHackingLevel() >= this.ns.getServerRequiredHackingLevel(this.name) && this.canRoot
    }

    get minSecurity() {
        return this.ns.getServerMinSecurityLevel(this.name)
    }

    get security() {
        return this.ns.getServerSecurityLevel(this.name)
    }

    get maxMoney() {
        return this.ns.getServerMaxMoney(this.name)
    }

    get money() {
        return this.ns.getServerMoneyAvailable(this.name)
    }

    get hackTime() {
        return this.ns.getHackTime(this.name)
    }

    get growTime() {
        return this.ns.getGrowTime(this.name)
    }

    get weakenTime() {
        return this.ns.getWeakenTime(this.name)
    }

    //Methods
    root(): void {
        const cracks: any[] = [this.ns.brutessh, this.ns.ftpcrack, this.ns.relaysmtp, this.ns.httpworm, this.ns.sqlinject]
        for (let i = 0; i < this.portsNeeded; i++) {
            cracks[i](this.name)
        }
        this.ns.nuke(this.name)
    }
}

export function getMults(ns: NS) {
    let mults = ns.getPlayer().mults
    let bnMults = undefined
    // Uncomment line after getting SF-5
    // bnMults = ns.getBitNodeMultipliers()
    if (bnMults !== undefined) {
        // TODO: Implement BN mults
    }
    return mults
}

export function numberWithCommas(x: number) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}