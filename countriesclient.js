class CountriesClient {
    constructor() {
        this._baseUrl = 'https://restcountries.com/v3.1';
        this._urls = {
            all: '/all',
            code: '/alpha/{code}',
        };
        this._requestCount = 0;
        this._cache = {};
    }

    get requestCount() {
        return this._requestCount;
    }

    _getUrl(urlName, urlParams, fields) {
        let url = this._urls[urlName];
        if (urlParams) {
            Object.keys(urlParams).forEach((paramName) => {
                url = url.replace(`{${paramName}}`, urlParams[paramName]);
            });
        }
        if (fields) {
            url += `?fields=${fields.toString()}`;
        }
        return this._baseUrl + url;
    }

    async _get(urlName, urlParams, fields) {
        const url = this._getUrl(urlName, urlParams, fields);
        let data = this._cache[url];
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
        this._requestCount += 1;
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        data = response.json();
        this._cache[url] = data;
        return data;
    }

    async getAll(fields) {
        return this._get('all', null, fields);
    }

    async searchByCountryCode(countryCode, fields) {
        return this._get('code', { code: countryCode }, fields);
    }
}

export default CountriesClient;
