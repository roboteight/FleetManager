export interface Aircraft {
    id: number;
    type: string;
    sizeClass: string;
    seats: number;
    speedKnots: number;
    rangeNauticalMiles: number;
    oem: string;
    category: string;
    runwayLengthFeet?: number;
    faaTypeCode?: string;
    tuvoliModelCode?: string;
    tuvoliModelDescription?: string;
    tuvoliExteriorImage?: string;
    tuvoliInteriorImage1?: string;
    tuvoliInteriorImage2?: string;
    notes?: string;
    variants?: string[];
}