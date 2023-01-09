export type StringMap<T> = {
    [key: string]: T;
}

export type CountryCode = string;

export type CountryCodeMap<T> = {
    [key: CountryCode]: T;
}

export type BaseCountry = {
    capital: string[];
    altSpellings: string[];
}

export type Country = BaseCountry & {
    name: CountryName;
    cca3: CountryCode;
    area: number;
    borders: CountryCode[];
}

export type CountryName = {
    common: string;
    official: string;
    nativeName: StringMap<CountryNativeName>;
}

export type CountryNativeName = {
    official: string;
    common: string;
}

export type CountryCodeArray = CountryCode[];
