export declare class AudioConverter {
    private static base64ToUint8Array;
    private static base64ToInt16Array;
    private static muLawToPCM;
    static pcmToMuLaw(sample: number): number;
    static convertBase64MuLawToBase64PCM16k(base64: string): string;
    static convertBase64PCM24kToBase64MuLaw8k(base64: string): string;
}
