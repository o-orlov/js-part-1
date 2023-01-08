class CountriesClient {
    static #BASE_URL = 'https://restcountries.com/v3.1';
    static #URLS = {
        all: '/all',
        code: '/alpha/{code}',
    };

    #requestCount;
    #cache;

    constructor() {
        this.#requestCount = 0;
        this.#cache = {};
    }

    get requestCount() {
        return this.#requestCount;
    }

    static #getUrl(urlName, urlParams, fields) {
        let url = CountriesClient.#URLS[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                url = url.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        if (fields) {
            url += `?fields=${fields.toString()}`;
        }
        return CountriesClient.#BASE_URL + url;
    }

    async #get(urlName, urlParams, fields) {
        const url = CountriesClient.#getUrl(urlName, urlParams, fields);
        let data = this.#cache[url];
        if (data !== undefined) {
            return data;
        }
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
        });
        this.#requestCount += 1;
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        data = response.json();
        this.#cache[url] = data;
        return data;
    }

    async getAll(fields) {
        return this.#get('all', null, fields);
    }

    async searchByCountryCode(countryCode, fields) {
        return this.#get('code', { code: countryCode }, fields);
    }
}

export default CountriesClient;
