class CountriesClient {
    constructor() {
        this.baseUrl = 'https://restcountries.com/v3.1';
        this.urls = {
            all: '/all',
            code: '/alpha/{code}',
            fullName: '/name/{name}?fullText=true',
        };
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
            this.getCountriesData();
        }
        const countryCode = this.countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
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
}

class RouteVariantTree {
    constructor(countryCode) {
        this.root = new RouteVariantTreeItem(countryCode, null);
    }
}

class RouteFinder {
    constructor(countriesService) {
        this.countriesService = countriesService;
        this.maxIterations = 10;
    }

    async findNeighbour(parents, countryCode, iteration = 1) {
        let found = false;

        const countryCodes = parents.map((item) => item.countryCode);
        const results = await this.countriesService.getNeighboursByCountryCodes(countryCodes);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const parent = parents[index];
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

        if (!found && iteration < this.maxIterations) {
            const children = [];
            parents.forEach((parent) => children.concat(parent.children));
            return this.findNeighbour(children, countryCode, iteration + 1);
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

        const fromCountryCode = await this.countriesService.getCountryCodeByName(fromCountryName);
        const toCountryCode = await this.countriesService.getCountryCodeByName(toCountryName);
        const tree = new RouteVariantTree(fromCountryCode);

        if (await this.findNeighbour([tree.root], toCountryCode)) {
            // TODO: Найти все валидные варианты маршрутов и вернуть их в строковом или JSON представлении.
            return `Found route from ${fromCountryName} to ${toCountryName}.`;
        }

        return null;
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
            .then((result) => {
                if (result !== null) {
                    showMessage(result);
                } else {
                    showMessage(`Route from ${fromCountry.value} to ${toCountry.value} not found.`);
                }
            })
            .catch(showError)
            .finally(() => {
                setInteractionDisabled(false);
            });
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
    });
})();
