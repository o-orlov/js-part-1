class CountriesClient {
    constructor() {
        this._baseUrl = 'https://restcountries.com/v3.1';
        this._urls = {
            all: '/all',
            code: '/alpha/{code}',
        };
        this._requestCount = 0;
    }

    get requestCount() {
        return this._requestCount;
    }

    _getUrl(urlName, urlParams, fields) {
        let url = this._urls[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                url = url.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        if (fields) {
            url += `?fields=${fields.toString()}`;
        }
        return this._baseUrl + url;
    }

    async _get(urlName, urlParams, fields) {
        const url = this._getUrl(urlName, urlParams, fields);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
        });
        this._requestCount += 1;
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response.json();
    }

    async getAll(fields) {
        return this._get('all', null, fields);
    }

    async searchByCountryCode(countryCode, fields) {
        return this._get('code', { code: countryCode }, fields);
    }
}

class CountriesService {
    constructor(client = new CountriesClient()) {
        this._client = client;
        this._countriesData = null;
        this._countryNameToCodeMapping = null;
    }

    async getCountriesData() {
        if (this._countriesData === null) {
            const data = await this._client.getAll(['name', 'cca3', 'area']);
            this._countriesData = data.reduce((result, country) => {
                result[country.cca3] = country;
                return result;
            }, {});
            this._countryNameToCodeMapping = data.reduce((result, country) => {
                result[country.name.common] = country.cca3;
                return result;
            }, {});
        }
        return this._countriesData;
    }

    async getCountryCodeByName(countryName) {
        if (this._countriesData === null) {
            await this.getCountriesData();
        }
        const countryCode = this._countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
    }

    async getCountryNameByCode(countryCode) {
        if (this._countriesData === null) {
            await this.getCountriesData();
        }
        const country = this._countriesData[countryCode];
        if (country === undefined) {
            throw new Error(`Country by code "${countryCode}" not found.`);
        }
        return country.name.common;
    }

    async getCountryNamesByCodes(countryCodes) {
        if (countryCodes.length === 0) {
            return [];
        }
        const promises = countryCodes.map(this.getCountryNameByCode.bind(this));
        const values = await Promise.all(promises);
        return values;
    }

    async getNeighboursByCountryCode(countryCode) {
        const data = await this._client.searchByCountryCode(countryCode, ['borders']);
        return data.borders;
    }

    async getNeighboursByCountryCodes(countryCodes) {
        if (countryCodes.length === 0) {
            return [];
        }
        const promises = countryCodes.map(this.getNeighboursByCountryCode.bind(this));
        const values = await Promise.all(promises);
        return values;
    }

    get requestCount() {
        return this._client.requestCount;
    }
}

class RouteVariantTreeItem {
    constructor(countryCode, parent = null) {
        this.countryCode = countryCode;
        this.parent = parent;
        this.children = [];
        this.checked = false;
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
    constructor(countriesService = new CountriesService(), maxIterations = 10) {
        this._countriesService = countriesService;
        this._maxIterations = maxIterations;
    }

    async _findNeighbour(parents, countryCode, checkedCountryCodes = new Set(), iteration = 1) {
        console.log(`Iteration: ${iteration}`);
        let found = false;
        const countryCodes = parents.map((item) => item.countryCode);
        const results = await this._countriesService.getNeighboursByCountryCodes(countryCodes);

        results.forEach((neighbours, index) => {
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
        const tree = new RouteVariantTree(fromCountryCode);
        const found = await this._findNeighbour([tree.root], toCountryCode);

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
