class CountriesClient {
    constructor() {
        this.baseUrl = 'https://restcountries.com/v3.1';
        this.urls = {
            all: '/all',
            code: '/alpha/{code}',
            fullName: '/name/{name}?fullText=true',
        };
        this.requestCount = 0;
    }

    getUrl(urlName, urlParams, fields) {
        let url = this.urls[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                url = url.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        if (fields) {
            url += `?fields=${fields.toString()}`;
        }
        return this.baseUrl + url;
    }

    async get(urlName, urlParams, fields) {
        const url = this.getUrl(urlName, urlParams, fields);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
        });
        this.requestCount += 1;
        return response.json();
    }

    async getAll(fields) {
        return this.get('all', null, fields);
    }

    async searchByCountryCode(countryCode, fields) {
        return this.get('code', { code: countryCode }, fields);
    }

    async searchByCountryName(countryName, fields) {
        return this.get('fullName', { name: countryName }, fields);
    }
}

class CountriesService {
    constructor() {
        this.client = new CountriesClient();
        this.countriesData = null;
        this.countryNameToCodeMapping = null;
        this.countryCodeToNeighboursMapping = {};
    }

    async getCountriesData() {
        if (this.countriesData === null) {
            const data = await this.client.getAll(['name', 'cca3', 'area']);
            this.countriesData = data.reduce((result, country) => {
                result[country.cca3] = country;
                return result;
            }, {});
            this.countryNameToCodeMapping = data.reduce((result, country) => {
                result[country.name.common] = country.cca3;
                return result;
            }, {});
        }
        return this.countriesData;
    }

    async getCountryCodeByName(countryName) {
        if (this.countriesData === null) {
            await this.getCountriesData();
        }
        const countryCode = this.countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
    }

    async getCountryNameByCode(countryCode) {
        if (this.countriesData === null) {
            await this.getCountriesData();
        }
        const country = this.countriesData[countryCode];
        if (country === undefined) {
            throw new Error(`Country by code "${countryCode}" not found.`);
        }
        return country.name.common;
    }

    async getCountryNamesByCodes(countryCodes) {
        const promises = countryCodes.map(this.getCountryNameByCode.bind(this));
        return Promise.allSettled(promises);
    }

    async getNeighboursByCountryCode(countryCode) {
        if (this.countryCodeToNeighboursMapping[countryCode] === undefined) {
            const data = await this.client.searchByCountryCode(countryCode, ['borders']);
            this.countryCodeToNeighboursMapping[countryCode] = data.borders;
        }
        return this.countryCodeToNeighboursMapping[countryCode];
    }

    async getNeighboursByCountryCodes(countryCodes) {
        const promises = countryCodes.map(this.getNeighboursByCountryCode.bind(this));
        return Promise.allSettled(promises);
    }

    getRequestCount() {
        return this.client.requestCount;
    }
}

class RouteVariantTreeItem {
    constructor(countryCode, parent) {
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
        this.root = new RouteVariantTreeItem(countryCode, null);
    }

    forEach(callback, item) {
        if (item === undefined) {
            item = this.root;
        }
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
    constructor(countriesService) {
        this.countriesService = countriesService;
        this.maxIterations = 10;
    }

    async findNeighbour(parents, countryCode, checkedCountryCodes = new Set(), iteration = 1) {
        console.log(`Iteration: ${iteration}`);
        let found = false;
        const countryCodes = parents
            .map((item) => item.countryCode)
            .filter((countryCode) => !checkedCountryCodes.has(countryCode));
        const results = await this.countriesService.getNeighboursByCountryCodes(countryCodes);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const parent = parents[index];
                checkedCountryCodes.add(parent.countryCode);
                const neighbours = result.value;
                neighbours.forEach((neighbour) => {
                    if (neighbour === countryCode) {
                        found = true;
                    }
                    const child = new RouteVariantTreeItem(neighbour, parent);
                    parent.appendChild(child);
                });
            } else {
                throw new Error(result.reason);
            }
        });
        console.log(`Country codes: ${[...checkedCountryCodes]}`);
        if (!found && iteration < this.maxIterations) {
            let children = [];
            for (const parent of parents) {
                children = children.concat(parent.children);
            }
            return this.findNeighbour(children, countryCode, checkedCountryCodes, iteration + 1);
        }
        return found;
    }

    async findRoute(fromCountryName, toCountryName) {
        if (!fromCountryName) {
            throw new Error('Departure country cannot be empty.');
        }
        if (!toCountryName) {
            throw new Error('Destination country cannot be empty.');
        }
        if (fromCountryName === toCountryName) {
            throw new Error('Departure and destination countries are the same.');
        }
        const requestCountBefore = this.countriesService.getRequestCount();
        const fromCountryCode = await this.countriesService.getCountryCodeByName(fromCountryName);
        const toCountryCode = await this.countriesService.getCountryCodeByName(toCountryName);
        const tree = new RouteVariantTree(fromCountryCode);
        const found = await this.findNeighbour([tree.root], toCountryCode);
        if (found) {
            let routes = tree.toArrays().filter((array) => array[array.length - 1] === toCountryCode);
            routes = await this.replaceCountryCodesWithNames(routes);
            return [routes, this.countriesService.getRequestCount() - requestCountBefore];
        }
        return [null, this.countriesService.getRequestCount() - requestCountBefore];
    }

    async replaceCountryCodesWithNames(routes) {
        const countryCodeToNameMapping = await this.getCountryCodeToNameMapping(routes);
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

    async getCountryCodeToNameMapping(routes) {
        let countryCodes = new Set();
        for (const route of routes) {
            for (const countryCode of route) {
                countryCodes.add(countryCode);
            }
        }
        countryCodes = [...countryCodes];

        const countryCodeToNameMapping = {};
        const results = await this.countriesService.getCountryNamesByCodes(countryCodes);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                countryCodeToNameMapping[countryCodes[index]] = result.value;
            } else {
                throw new Error(result.reason);
            }
        });
        return countryCodeToNameMapping;
    }
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

const countriesService = new CountriesService();
const routeFinder = new RouteFinder(countriesService);

function setInteractionDisabled(disabled) {
    fromCountry.disabled = disabled;
    toCountry.disabled = disabled;
    submit.disabled = disabled;
}

function showMessage(message) {
    output.textContent = message;
}

function showError(error) {
    output.textContent = `Error: ${error.message}`;
}

function showResult(result) {
    let route = '';
    if (result[0] !== null) {
        for (const variant of result[0]) {
            route += `${variant.join(' → ')}\r\n`;
        }
        route = route.trim();
    } else {
        route = `Route from ${fromCountry.value} to ${toCountry.value} not found.`;
    }
    output.textContent = `${route}\r\n\r\nAPI calls: ${result[1]}`;
}

function clearMessage() {
    output.textContent = '';
}

(async () => {
    setInteractionDisabled(true);

    showMessage('Loading…');
    const countriesData = await countriesService.getCountriesData();
    clearMessage();

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    setInteractionDisabled(false);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        clearMessage();
        setInteractionDisabled(true);
        showMessage(`Finding route from ${fromCountry.value} to ${toCountry.value}…`);
        routeFinder
            .findRoute(fromCountry.value, toCountry.value)
            .then(showResult)
            .catch(showError)
            .finally(() => {
                setInteractionDisabled(false);
            });
    });
})();
