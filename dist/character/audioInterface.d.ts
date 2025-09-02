import Audio from 'naudiodon-arm-rpi';
export default class AudioInterface {
    /**
     * Sets the `sox` path. Will call via PATH/Shell first if null (default).
     */
    static soxPath: string | null;
    /**
     * Gets all the available audio devices
     * @returns Device infos about all devices
     */
    static getAllDevices(): Audio.DeviceInfo[];
    /**
     * Gets all the available microphones
     * @returns Device infos about all the available microphones
     */
    static getMicrophones(): Audio.DeviceInfo[];
    /**
     * Gets all the available speakers
     * @returns Device infos about all the available speakers
     */
    static getSpeakers(): Audio.DeviceInfo[];
    private static findDeviceWithCriteria;
    /**
     * Gets a microphone with its id
     * @returns Found device info or `undefined`
     */
    static getMicrophoneFromId(id: number): Audio.DeviceInfo | undefined;
    /**
     * Gets a microphone from its name
     * @returns Found device info or `undefined`
     */
    static getMicrophoneFromName(name: string): Audio.DeviceInfo | undefined;
    /**
     * Gets a speaker with an id
     * @returns Found device info or `undefined`
     */
    static getSpeakerFromId(id: number): Audio.DeviceInfo | undefined;
    /**
     * Gets a speaker from its name
     * @returns Found device info or `undefined`
     */
    static getSpeakerFromName(name: string): Audio.DeviceInfo | undefined;
}
//# sourceMappingURL=audioInterface.d.ts.map