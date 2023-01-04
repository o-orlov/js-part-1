import CountriesService from '/countriesservice.js';
import Maps from '/maps.js';

class RouteVariantTreeItem {
    constructor(countryCode, parent = null) {
        this.countryCode = countryCode;
        this.parent = parent;
        this.children = [];
    }

    appendChild(child) {
        this.children.push(child);
    }

    isLeaf() {
        return this.children.length === 0;
    }
}

class RouteVariantTree {
    constructor(countryCode) {
        this.root = new RouteVariantTreeItem(countryCode);
    }

    forEach(callback, item = this.root) {
        for (const child of item.children) {
            this.forEach(callback, child);
        }
        callback(item);
    }

    getLeaves() {
        const leaves = [];
        this.forEach((item) => {
            if (item.isLeaf()) {
                leaves.push(item);
            }
        });
        return leaves;
    }

    toArrays() {
        const arrays = [];
        this.getLeaves().forEach((item) => {
            const array = [];
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
    constructor(countriesService, maxIterations = 10) {
        this._countriesService = countriesService || new CountriesService();
        this._maxIterations = maxIterations;
    }

    async _findNeighbour(parents, countryCode, checkedCountryCodes, iteration = 1) {
        console.log(`Iteration: ${iteration}`);
        let found = false;
        const countryCodes = parents.map((item) => item.countryCode);
        const results = await this._countriesService.getNeighboursByCountryCodes(countryCodes);

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

        if (!found && iteration < this._maxIterations) {
            for (const countryCode of countryCodes) {
                checkedCountryCodes.add(countryCode);
            }
            let children = [];
            for (const parent of parents) {
                children = children.concat(
                    parent.children.filter((child) => !checkedCountryCodes.has(child.countryCode))
                );
            }
            if (children.length === 0) {
                console.log('All possible countries have already been checked');
                return false;
            }
            return this._findNeighbour(children, countryCode, checkedCountryCodes, iteration + 1);
        }

        return found;
    }

    async findRoute(fromCountryName, toCountryName) {
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

        const requestCountBefore = this._countriesService.requestCount;
        const fromCountryCode = await this._countriesService.getCountryCodeByName(fromCountryName);
        const toCountryCode = await this._countriesService.getCountryCodeByName(toCountryName);
        console.log(`Finding route from ${fromCountryCode} to ${toCountryCode}…`);
        Maps.setEndPoints(fromCountryCode, toCountryCode);
        const tree = new RouteVariantTree(fromCountryCode);
        const found = await this._findNeighbour([tree.root], toCountryCode, new Set());

        if (found) {
            let routes = tree.toArrays().filter((array) => array[array.length - 1] === toCountryCode);
            console.log(`Found route variants: ${routes.length}`);
            routes = await this._replaceCountryCodesWithNames(routes);
            return [routes, this._countriesService.requestCount - requestCountBefore];
        }

        console.log('Route variants not found');
        return [null, this._countriesService.requestCount - requestCountBefore];
    }

    async _replaceCountryCodesWithNames(routes) {
        const countryCodeToNameMapping = await this._getCountryCodeToNameMapping(routes);
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

    async _getCountryCodeToNameMapping(routes) {
        let countryCodes = new Set();
        for (const route of routes) {
            for (const countryCode of route) {
                countryCodes.add(countryCode);
            }
        }
        countryCodes = [...countryCodes];

        const countryCodeToNameMapping = {};
        const countryNames = await this._countriesService.getCountryNamesByCodes(countryCodes);
        countryNames.forEach((countryName, index) => {
            countryCodeToNameMapping[countryCodes[index]] = countryName;
        });
        return countryCodeToNameMapping;
    }
}

export default RouteFinder;
