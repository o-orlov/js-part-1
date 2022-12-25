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
        this.countriesClient = new CountriesClient();
        this.countriesData = null;
        this.countryNameToCodeMapping = null;
    }

    async getCountriesData() {
        if (this.countriesData === null) {
            const data = await this.countriesClient.getAll(['name', 'cca3', 'area']);
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
        const data = await this.countriesClient.searchByCountryCode(countryCode, ['borders']);
        return data.borders;
    }

    async getNeighboursByCountryName(countryName) {
        const data = await this.countriesClient.searchByCountryName(countryName, ['borders']);
        return data.borders;
    }

    async calculateRoute(fromCountryName, toCountryName) {
        const fromCountryCode = await this.getCountryCodeByName(fromCountryName);
        const toCountryCode = await this.getCountryCodeByName(toCountryName);
        // TODO: Вернуть найденный маршрут или выдать ошибку.
        return [fromCountryName, toCountryName];
    }
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

const countriesService = new CountriesService();

function setInteractionDisabled(disabled) {
    fromCountry.disabled = disabled;
    toCountry.disabled = disabled;
    submit.disabled = disabled;
}

function showMessage(message) {
    output.textContent = message;
}

function showError(error) {
    output.textContent = `Error! ${error.message}`;
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
        showMessage(`Calculating route from ${fromCountry.value} to ${toCountry.value}…`);
        countriesService
            .calculateRoute(fromCountry.value, toCountry.value)
            .then((route) => {
                showMessage(route.join(' → '));
            })
            .catch((reason) => {
                if (reason instanceof Error) {
                    showError(reason);
                } else {
                    console.log(reason);
                }
            })
            .finally(() => {
                setInteractionDisabled(false);
            });
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
    });
})();
