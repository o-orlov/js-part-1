class CountriesClient {
    constructor() {
        this.baseUrl = 'https://restcountries.com/v3.1';
        this.urls = {
            all: '/all',
            code: '/alpha/{code}',
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
}

class CountriesService {
    constructor() {
        this.countriesClient = new CountriesClient();
        this.countriesData = null;
    }

    async getCountriesData() {
        if (this.countriesData === null) {
            const data = await this.countriesClient.getAll(['name', 'cca3', 'area']);
            this.countriesData = data.reduce((result, country) => {
                result[country.cca3] = country;
                return result;
            }, {});
        }
        return this.countriesData;
    }

    async getCountryName(countryCode) {
        const countryData = (await this.getCountriesData())[countryCode];
        return countryData.name.common;
    }

    async getNeighbours(countryCode) {
        const data = await this.countriesClient.searchByCountryCode(countryCode, ['borders']);
        return data.borders;
    }

    async getCalculatingRouteMessage(fromCountryCode, toCountryCode) {
        const fromCountryName = await this.getCountryName(fromCountryCode);
        const toCountryName = await this.getCountryName(toCountryCode);
        return `Calculating route from ${fromCountryName} (${fromCountryCode}) to ${toCountryName} (${toCountryCode})…`;
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
            option.value = code;
            option.label = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    setInteractionDisabled(false);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        setInteractionDisabled(true);
        countriesService.getCalculatingRouteMessage(fromCountry.value, toCountry.value).then(showMessage);
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
        setTimeout(() => {
            clearMessage();
            setInteractionDisabled(false);
        }, 1000); // TODO: Удалить тестовую задержку (установить 0)
    });
})();
