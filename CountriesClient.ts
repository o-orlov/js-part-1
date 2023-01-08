import type { StringMap, CountryCode, BaseCountry } from './types.js';

class CountriesClient {
    static #BASE_URL: string = 'https://restcountries.com';
    static #API_VERSION: string = 'v3.1';
    static #PATHNAMES: StringMap<string> = {
        all: '/all',
        code: '/alpha/{code}',
    };

    #requestCount: number;
    #cache: StringMap<unknown>;

    constructor() {
        this.#requestCount = 0;
        this.#cache = {};
    }

    get requestCount(): number {
        return this.#requestCount;
    }

    static #getUrl(urlName: string, urlParams?: StringMap<string> | null, fields?: string[] | null): URL {
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

    async #get(urlName: string, urlParams?: StringMap<string> | null, fields?: string[] | null): Promise<unknown> | never {
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

    async getAll(fields?: string[] | null): Promise<BaseCountry[]> | never {
        return this.#get('all', null, fields) as Promise<BaseCountry[]>;
    }

    async searchByCountryCode(countryCode: CountryCode, fields?: string[] | null): Promise<BaseCountry> | never {
        return this.#get('code', { code: countryCode }, fields) as Promise<BaseCountry>;
    }
}

export default CountriesClient;
