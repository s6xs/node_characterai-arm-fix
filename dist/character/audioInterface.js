"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const naudiodon_arm_rpi_1 = __importDefault(require("naudiodon-arm-rpi"));
class AudioInterface {
    /**
     * Gets all the available audio devices
     * @returns Device infos about all devices
     */
    static getAllDevices() { return naudiodon_arm_rpi_1.default.getDevices(); }
    /**
     * Gets all the available microphones
     * @returns Device infos about all the available microphones
     */
    static getMicrophones() {
        return this.getAllDevices().filter(device => device.maxInputChannels > 0);
    }
    /**
     * Gets all the available speakers
     * @returns Device infos about all the available speakers
     */
    static getSpeakers() {
        return this.getAllDevices().filter(device => device.maxOutputChannels > 0);
    }
    static findDeviceWithCriteria(devices, index, target) {
        return devices.find(device => device[index] == target);
    }
    /**
     * Gets a microphone with its id
     * @returns Found device info or `undefined`
     */
    static getMicrophoneFromId(id) {
        return this.findDeviceWithCriteria(this.getMicrophones(), 'id', id);
    }
    /**
     * Gets a microphone from its name
     * @returns Found device info or `undefined`
     */
    static getMicrophoneFromName(name) {
        return this.findDeviceWithCriteria(this.getMicrophones(), 'name', name);
    }
    /**
     * Gets a speaker with an id
     * @returns Found device info or `undefined`
     */
    static getSpeakerFromId(id) {
        return this.findDeviceWithCriteria(this.getSpeakers(), 'id', id);
    }
    /**
     * Gets a speaker from its name
     * @returns Found device info or `undefined`
     */
    static getSpeakerFromName(name) {
        return this.findDeviceWithCriteria(this.getSpeakers(), 'name', name);
    }
}
/**
 * Sets the `sox` path. Will call via PATH/Shell first if null (default).
 */
AudioInterface.soxPath = null;
exports.default = AudioInterface;
;
//# sourceMappingURL=audioInterface.js.map