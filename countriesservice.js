import CountriesClient from '/countriesclient.js';

class CountriesService {
    constructor(client) {
        this._client = client || new CountriesClient();
        this._countriesData = null;
        this._countryNameToCodeMapping = null;
    }

    async getCountriesData() {
        if (this._countriesData === null) {
            const data = await this._client.getAll(['name', 'cca3', 'area']);
            this._countriesData = data.reduce((result, country) => {
                result[country.cca3] = country;
                return result;
            }, {});
            this._countryNameToCodeMapping = data.reduce((result, country) => {
                result[country.name.common] = country.cca3;
                return result;
            }, {});
        }
        return this._countriesData;
    }

    async getCountryCodeByName(countryName) {
        if (this._countriesData === null) {
            await this.getCountriesData();
        }
        const countryCode = this._countryNameToCodeMapping[countryName];
        if (countryCode === undefined) {
            throw new Error(`Country code by name "${countryName}" not found.`);
        }
        return countryCode;
    }

    async getCountryNameByCode(countryCode) {
        if (this._countriesData === null) {
            await this.getCountriesData();
        }
        const country = this._countriesData[countryCode];
        if (country === undefined) {
            throw new Error(`Country by code "${countryCode}" not found.`);
        }
        return country.name.common;
    }

    async getCountryNamesByCodes(countryCodes) {
        if (countryCodes.length === 0) {
            return [];
        }
        const promises = countryCodes.map(this.getCountryNameByCode.bind(this));
        const values = await Promise.all(promises);
        return values;
    }

    async getNeighboursByCountryCode(countryCode) {
        const data = await this._client.searchByCountryCode(countryCode, ['borders']);
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
        return this._client.requestCount;
    }
}

export default CountriesService;
