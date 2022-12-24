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
        return this.get('all', undefined, fields);
    }

    async searchByCountryCode(countryCode, fields) {
        return this.get('code', { code: countryCode }, fields);
    }
}

class CountriesService {
    constructor() {
        this.countriesClient = new CountriesClient();
    }

    async getCountriesData() {
        const data = await this.countriesClient.getAll(['name', 'cca3', 'area']);
        return data.reduce((result, country) => {
            result[country.cca3] = country;
            return result;
        }, {});
    }

    async getNeighbours(countryCode) {
        const data = await this.countriesClient.searchByCountryCode(countryCode, ['borders']);
        return data.borders;
    }
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');
const countriesService = new CountriesService();

(async () => {
    fromCountry.disabled = true;
    toCountry.disabled = true;
    submit.disabled = true;

    output.textContent = 'Loading…';
    const countriesData = await countriesService.getCountriesData();
    output.textContent = '';

    // TODO: Удалить тестовый вывод запроса соседних с РФ стран
    console.log(await countriesService.getNeighbours('RUS'));

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    fromCountry.disabled = false;
    toCountry.disabled = false;
    submit.disabled = false;

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
    });
})();
