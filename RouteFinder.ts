import type { CountryCode, CountryCodeMap, CountryCodeArray } from './types.js';
import CountriesService from './CountriesService.js';
import Maps from './maps.js';

class RouteVariantTreeItem {
    countryCode: CountryCode;
    parent: RouteVariantTreeItem | null;
    children: RouteVariantTreeItem[];

    constructor(countryCode: CountryCode, parent: RouteVariantTreeItem | null = null) {
        this.countryCode = countryCode;
        this.parent = parent;
        this.children = [];
    }

    appendChild(child: RouteVariantTreeItem): void {
        this.children.push(child);
    }

    isLeaf(): boolean {
        return this.children.length === 0;
    }
}

class RouteVariantTree {
    root: RouteVariantTreeItem;

    constructor(countryCode: CountryCode) {
        this.root = new RouteVariantTreeItem(countryCode);
    }

    forEach(callback: (item: RouteVariantTreeItem) => void, item: RouteVariantTreeItem = this.root): void {
        for (const child of item.children) {
            this.forEach(callback, child);
        }
        callback(item);
    }

    getLeaves(): RouteVariantTreeItem[] {
        const leaves: RouteVariantTreeItem[] = [];
        this.forEach((item: RouteVariantTreeItem) => {
            if (item.isLeaf()) {
                leaves.push(item);
            }
        });
        return leaves;
    }

    toArrays(): CountryCodeArray[] {
        const arrays: CountryCodeArray[] = [];
        this.getLeaves().forEach((leaf) => {
            const array = [];
            let item: RouteVariantTreeItem | null = leaf;
            do {
                array.push(item.countryCode);
                item = item.parent;
            } while (item !== null);
            array.reverse();
            arrays.push(array);
        });
        return arrays;
    }
}

class RouteFinder {
    #countriesService: CountriesService;
    #maxIterations: number;

    constructor(countriesService?: CountriesService, maxIterations: number = 10) {
        this.#countriesService = countriesService || new CountriesService();
        this.#maxIterations = maxIterations;
    }

    async #findNeighbour(parents: RouteVariantTreeItem[], countryCode: CountryCode, checkedCountryCodes: Set<CountryCode>, iteration: number = 1): Promise<boolean> | never {
        console.log(`Iteration: ${iteration}`);
        let found = false;
        const countryCodes = parents.map((item) => item.countryCode);
        const results = await this.#countriesService.getNeighboursByCountryCodes(countryCodes);

        results.forEach((neighbours, index) => {
            Maps.markAsVisited(neighbours);
            const parent = parents[index];
            for (const neighbour of neighbours) {
                if (neighbour === countryCode) {
                    found = true;
                }
                const child = new RouteVariantTreeItem(neighbour, parent);
                parent.appendChild(child);
            }
        });

        if (!found && iteration < this.#maxIterations) {
            for (const countryCode of countryCodes) {
                checkedCountryCodes.add(countryCode);
            }
            let children: RouteVariantTreeItem[] = [];
            for (const parent of parents) {
                children = children.concat(
                    parent.children.filter((child) => !checkedCountryCodes.has(child.countryCode))
                );
            }
            if (children.length === 0) {
                console.log('All possible countries have already been checked');
                return false;
            }
            return this.#findNeighbour(children, countryCode, checkedCountryCodes, iteration + 1);
        }

        return found;
    }

    async findRoute(fromCountryName: string, toCountryName: string): Promise<[Array<string[]> | null, number]> | never {
        if (!fromCountryName && !toCountryName) {
            throw new Error('Departure and destination countries are required.');
        }
        if (!fromCountryName) {
            throw new Error('Departure country is required.');
        }
        if (!toCountryName) {
            throw new Error('Destination country is required.');
        }
        if (fromCountryName === toCountryName) {
            throw new Error('Departure and destination countries are the same.');
        }

        const requestCountBefore = this.#countriesService.requestCount;
        const fromCountryCode = await this.#countriesService.getCountryCodeByName(fromCountryName);
        const toCountryCode = await this.#countriesService.getCountryCodeByName(toCountryName);
        console.log(`Finding route from ${fromCountryCode} to ${toCountryCode}…`);
        Maps.setEndPoints(fromCountryCode, toCountryCode);
        const tree = new RouteVariantTree(fromCountryCode);
        const found = await this.#findNeighbour([tree.root], toCountryCode, new Set());

        if (found) {
            let routes = tree.toArrays().filter((array) => array[array.length - 1] === toCountryCode);
            console.log(`Found route variants: ${routes.length}`);
            routes = await this.#replaceCountryCodesWithNames(routes);
            return [routes, this.#countriesService.requestCount - requestCountBefore];
        }

        console.log('Route variants not found');
        return [null, this.#countriesService.requestCount - requestCountBefore];
    }

    async #replaceCountryCodesWithNames(routes: CountryCodeArray[]): Promise<Array<string[]>> {
        const countryCodeToNameMapping = await this.#getCountryCodeToNameMapping(routes);
        const newRoutes = [];
        for (const route of routes) {
            const newRoute = [];
            for (const countryCode of route) {
                newRoute.push(countryCodeToNameMapping[countryCode]);
            }
            newRoutes.push(newRoute);
        }
        return newRoutes;
    }

    async #getCountryCodeToNameMapping(routes: CountryCodeArray[]): Promise<CountryCodeMap<string>> {
        let countryCodes: Set<CountryCode> | CountryCode[] = new Set();
        for (const route of routes) {
            for (const countryCode of route) {
                countryCodes.add(countryCode);
            }
        }
        countryCodes = [...countryCodes];

        const countryCodeToNameMapping: CountryCodeMap<string> = {};
        const countryNames = await this.#countriesService.getCountryNamesByCodes(countryCodes);
        countryNames.forEach((countryName, index) => {
            if (Array.isArray(countryCodes)) {
                countryCodeToNameMapping[countryCodes[index]] = countryName;
            }
        });
        return countryCodeToNameMapping;
    }
}

export default RouteFinder;
