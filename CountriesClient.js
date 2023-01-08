class CountriesClient {
    static #BASE_URL = 'https://restcountries.com';
    static #API_VERSION = 'v3.1';
    static #PATHNAMES = {
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
        let pathname = CountriesClient.#PATHNAMES[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                pathname = pathname.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        const url = new URL(`${CountriesClient.#API_VERSION}${pathname}`, CountriesClient.#BASE_URL);
        if (fields) {
            for (const field of fields) {
                url.searchParams.append('fields', field);
            }
        }
        return url;
    }

    async #get(urlName, urlParams, fields) {
        const url = CountriesClient.#getUrl(urlName, urlParams, fields);
        let data = this.#cache[url.href];
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
        this.#cache[url.href] = data;
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
