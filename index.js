class CountriesClient {
    constructor() {
        this.baseUrl = 'https://restcountries.com/v3.1';
        this.urls = {
            all: '/all?fields=name,cca3,area',
            code: '/alpha/{code}?fields=borders',
        };
    }

    getUrl(urlName, urlParams) {
        let url = this.urls[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                url = url.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        return this.baseUrl + url;
    }

    async get(urlName, urlParams) {
        const url = this.getUrl(urlName, urlParams);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
        });
        return response.json();
    }

    async getCountriesData() {
        const data = await this.get('all');
        return data.reduce((result, country) => {
            result[country.cca3] = country;
            return result;
        }, {});
    }

    async getNeighbours(countryCode) {
        const data = await this.get('code', { code: countryCode });
        return data.borders;
    }
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');
const countriesClient = new CountriesClient();

(async () => {
    fromCountry.disabled = true;
    toCountry.disabled = true;
    submit.disabled = true;

    output.textContent = 'Loading…';
    const countriesData = await countriesClient.getCountriesData();
    output.textContent = '';

    // TODO: Удалить тестовый вывод запроса соседних с РФ стран
    console.log(await countriesClient.getNeighbours('RUS'));

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
