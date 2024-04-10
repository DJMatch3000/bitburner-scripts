import { NS } from "@ns";

const CORP_NAME: string = "Matchefts Enterprises"
const DIVISION_MATERIALS: {[key: string]: string[]} = {
    "Agriculture": ["Plants", "Food"],
    "Tobacco": [],
    "Chemical": ["Chemicals"],
    "Spring Water": ["Water"]
}
const PARTY_COST = 1e6

export async function main(ns: NS): Promise<void> {
    await initSetup(ns)
    manageMorale(ns)
}

async function initSetup(ns: NS): Promise<void> {
    // Create corp
    if (!ns.corporation.hasCorporation()) {
        while (ns.getResetInfo().currentNode !== 3 && ns.getServerMoneyAvailable("home") < 150e9) {
            await ns.asleep(200)
        }
        ns.corporation.createCorporation(CORP_NAME, ns.getResetInfo().currentNode !== 3)
    }
    // Buy Smart Supply
    if (!ns.corporation.hasUnlock("Smart Supply")) {
        ns.corporation.purchaseUnlock("Smart Supply")
    }
    // Open Agri division
    if (!ns.corporation.getCorporation().divisions.includes("Agriculture")) {
        ns.corporation.expandIndustry("Agriculture", "Agriculture")
    }
    // Expand to all cities
    await expandToAllCities(ns, "Agriculture")
}

async function expandToAllCities(ns: NS, divisionName: string): Promise<void> {
    for (let city of Object.values(ns.enums.CityName)) {
        if (!ns.corporation.getDivision(divisionName).cities.includes(city)) {
            while (ns.corporation.getCorporation().funds < ns.corporation.getConstants().officeInitialCost) {
                await ns.asleep(200)
            }
            ns.corporation.expandCity(divisionName, city)
        }
        if (!ns.corporation.hasWarehouse(divisionName, city)) {
            while (ns.corporation.getCorporation().funds < ns.corporation.getConstants().warehouseInitialCost) {
                await ns.asleep(200)
            }
            ns.corporation.purchaseWarehouse(divisionName, city)
            // Set sell prices
            for (let material of DIVISION_MATERIALS[divisionName]) {
                ns.corporation.sellMaterial(divisionName, city, material, "MAX", "MP")
                if (ns.corporation.hasResearched(divisionName, "Market-TA.II")) {
                    ns.corporation.setMaterialMarketTA2(divisionName, city, material, true)
                }
            }
        }
    }
}

function manageMorale(ns: NS) {
    for (let division of ns.corporation.getCorporation().divisions) {
        for (let city of Object.values(ns.enums.CityName)) {
            let office = ns.corporation.getOffice(division, city)
            if (office.avgEnergy < office.maxEnergy) {
                ns.corporation.buyTea(division, city)
            }
            if (office.avgMorale < office.maxMorale) {
                ns.corporation.throwParty(division, city, PARTY_COST)
            }
        }
    }
}