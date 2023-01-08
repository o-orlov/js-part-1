import type { StringMap, CountryCode, CountryCodeMap, Country, CountryCodeArray } from './types.js';
import CountriesClient from './CountriesClient.js';

class CountriesService {
    #client: CountriesClient;
    #countriesData: CountryCodeMap<Country> | null;
    #countryNameToCodeMapping: StringMap<CountryCode> | null;

    constructor(client?: CountriesClient) {
        this.#client = client || new CountriesClient();
        this.#countriesData = null;
        this.#countryNameToCodeMapping = null;
    }

    async #loadData(): Promise<void> | never {
        const data = await this.#client.getAll(['name', 'cca3', 'area', 'borders']) as Country[];
        this.#countriesData = data.reduce((result: CountryCodeMap<Country>, country: Country) => {
            result[country.cca3] = country;
            return result;
        }, {});
        this.#countryNameToCodeMapping = data.reduce((result: StringMap<CountryCode>, country: Country) => {
            result[country.name.common] = country.cca3;
            return result;
        }, {});
    }

    async #ensureDataLoaded(): Promise<void> | never {
        if (this.#countriesData === null || this.#countryNameToCodeMapping === null) {
            await this.#loadData();
        }
    }

    async getCountriesData(): Promise<CountryCodeMap<Country>> | never {
        await this.#ensureDataLoaded();
        // @ts-expect-error: Object is possibly 'null'
        return this.#countriesData;
    }

    async getCountryCodeByName(countryName: string): Promise<CountryCode> | never {
        await this.#ensureDataLoaded();
        // @ts-expect-error: Object is possibly 'null'
        const countryCode = this.#countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
    }

    async getCountryNameByCode(countryCode: CountryCode): Promise<string> | never {
        await this.#ensureDataLoaded();
        // @ts-expect-error: Object is possibly 'null'
        const country = this.#countriesData[countryCode];
        if (country === undefined) {
            throw new Error(`Country by code "${countryCode}" not found.`);
        }
        return country.name.common;
    }

    async getCountryNamesByCodes(countryCodes: CountryCode[]): Promise<string[]> | never {
        if (countryCodes.length === 0) {
            return [];
        }
        const values = [];
        for (const countryCode of countryCodes) {
            // eslint-disable-next-line no-await-in-loop
            const value = await this.getCountryNameByCode(countryCode);
            values.push(value);
        }
        return values;
    }

    async getNeighboursByCountryCode(countryCode: CountryCode): Promise<CountryCodeArray> | never {
        await this.#ensureDataLoaded();
        // @ts-expect-error: Object is possibly 'null'
        const data = this.#countriesData[countryCode];
        if (data === undefined) {
            throw new Error(`Neighbours by country code "${countryCode}" not found.`);
        }
        return data.borders;
    }

    async getNeighboursByCountryCodes(countryCodes: CountryCode[]): Promise<CountryCodeArray[]> | never {
        if (countryCodes.length === 0) {
            return [];
        }
        const values = [];
        for (const countryCode of countryCodes) {
            // eslint-disable-next-line no-await-in-loop
            const value = await this.getNeighboursByCountryCode(countryCode);
            values.push(value);
        }
        return values;
    }

    get requestCount(): number {
        return this.#client.requestCount;
    }
}

export default CountriesService;
