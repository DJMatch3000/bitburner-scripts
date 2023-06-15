import { NS } from "@ns";
// import { Server, getAllServers } from "utils"
import * as utils from "utils"

export async function main(ns: NS): Promise<void> {
    ns.tprint("$" + utils.numberWithCommas(ns.getPurchasedServerCost(8192)))
}
