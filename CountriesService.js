import CountriesClient from '/CountriesClient.js';

class CountriesService {
    #client;
    #countriesData;
    #countryNameToCodeMapping;

    constructor(client) {
        this.#client = client || new CountriesClient();
        this.#countriesData = null;
        this.#countryNameToCodeMapping = null;
    }

    async getCountriesData() {
        if (this.#countriesData === null) {
            const data = await this.#client.getAll(['name', 'cca3', 'area']);
            this.#countriesData = data.reduce((result, country) => {
                result[country.cca3] = country;
                return result;
            }, {});
            this.#countryNameToCodeMapping = data.reduce((result, country) => {
                result[country.name.common] = country.cca3;
                return result;
            }, {});
        }
        return this.#countriesData;
    }

    async getCountryCodeByName(countryName) {
        if (this.#countriesData === null) {
            await this.getCountriesData();
        }
        const countryCode = this.#countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
    }

    async getCountryNameByCode(countryCode) {
        if (this.#countriesData === null) {
            await this.getCountriesData();
        }
        const country = this.#countriesData[countryCode];
        if (country === undefined) {
            throw new Error(`Country by code "${countryCode}" not found.`);
        }
        return country.name.common;
    }

    async getCountryNamesByCodes(countryCodes) {
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

    async getNeighboursByCountryCode(countryCode) {
        const data = await this.#client.searchByCountryCode(countryCode, ['borders']);
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
        return this.#client.requestCount;
    }
}

export default CountriesService;
