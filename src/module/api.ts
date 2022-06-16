import CONSTANTS from './constants';
import EffectInterface from './effects/effect-interface';
import { error } from './lib/lib';
import type { ActiveEffectData } from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/module.mjs';
import type Effect from './effects/effect';
import type { EffectActions } from './effects/effect-models';
import StatusEffectsLib from './effects/status-effects';

const API = {
  effectInterface: EffectInterface,
  statusEffects: StatusEffectsLib,

  get _defaultStatusEffectNames() {
    return [
     // add something here ???
    ];
  },

  /**
   * Returns the game setting for the status effect names
   *
   * @returns {String[]} the names of all the status effects
   */
  get statusEffectNames():string[] {
    return <string[]>game.settings.get(CONSTANTS.MODULE_NAME, 'statusEffectNames');
  },

  /**
   * Adds a given effect name to the saved status effect settings
   *
   * @param {string} name - the name of the effect to add to status effects
   * @returns {Promise} a promise that resolves when the settings update is complete
   */
  async addStatusEffect(name) {
    let statusEffectsArray = this.statusEffectNames;
    statusEffectsArray.push(name);

    statusEffectsArray = [...new Set(statusEffectsArray)]; // remove duplicates

    return game.settings.set(
      CONSTANTS.MODULE_NAME,
      'statusEffectNames',
      statusEffectsArray
    );
  },

  /**
   * Removes a given effect name from the saved status effect settings
   *
   * @param {string} name - the name of the effect to remove from status effects
   * @returns {Promise} a promise that resolves when the settings update is complete
   */
  async removeStatusEffect(name) {
    const statusEffectsArray = this.statusEffectNames.filter(
      (statusEffect) => statusEffect !== name
    );
    return game.settings.set(
      CONSTANTS.MODULE_NAME,
      'statusEffectNames',
      statusEffectsArray
    );
  },

  /**
   * Reset status effects back to the original defaults
   *
   * @returns {Promise} a promise that resolves when the settings update is complete
   */
  async resetStatusEffects() {
    return game.settings.set(
      CONSTANTS.MODULE_NAME,
      'statusEffectNames',
      this._defaultStatusEffectNames
    );
  },

  /**
   * Checks if the given effect name is a status effect
   *
   * @param {string} name - the effect name to search for
   * @returns {boolean} true if the effect is a status effect, false otherwise
   */
  isStatusEffect(name) {
    return this.statusEffectNames.includes(name);
  },

  // ======================
  // Effect Management
  // ======================

  async removeEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffect(effectName, uuid);
    return result;
  },

  async toggleEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('toggleEffectArr | inAttributes must be of type array');
    }
    const [effectName, overlay, uuids, metadata, effectData] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.toggleEffect(
      effectName,
      overlay,
      uuids,
      metadata,
      effectData);
    return result;
  },

  async addEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('addEffectArr | inAttributes must be of type array');
    }
    const [effectName, effectData, uuid, origin, overlay, metadata] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.addEffect(
      effectName,
      effectData,
      uuid,
      origin,
      overlay,
      metadata);
    return result;
  },

  async hasEffectAppliedArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('hasEffectAppliedArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.hasEffectApplied(effectName, uuid);
    return result;
  },

  async hasEffectAppliedOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('hasEffectAppliedOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid, includeDisabled] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.hasEffectAppliedOnActor(
      effectName,
      uuid,
      includeDisabled,
    );
    return result;
  },

  async hasEffectAppliedFromIdOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('hasEffectAppliedFromIdOnActorArr | inAttributes must be of type array');
    }
    const [effectId, uuid, includeDisabled] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.hasEffectAppliedFromIdOnActor(
      effectId,
      uuid,
      includeDisabled,
    );
    return result;
  },

  async addEffectOnActorArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw error('addEffectOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effect] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.addEffectOnActor(
      effectName,
      uuid,
      origin,
      overlay,
      effect,
    );
    return result;
  },

  async removeEffectOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffectOnActor(effectName, uuid);
    return result;
  },

  async removeEffectFromIdOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectFromIdOnActor | inAttributes must be of type array');
    }
    const [effectId, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffectFromIdOnActor(
      effectId,
      uuid,
    );
    return result;
  },

  async toggleEffectFromIdOnActorArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw error('addEffectOnActorArr | inAttributes must be of type array');
    }
    const [effectId, uuid, alwaysDelete, forceEnabled, forceDisabled] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.toggleEffectFromIdOnActor(
      effectId,
      uuid,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
    );
    return result;
  },

  async findEffectByNameOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | null> {
    if (!Array.isArray(inAttributes)) {
      throw error('findEffectByNameOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.findEffectByNameOnActor(
      effectName,
      uuid,
    );
    return result;
  },

  async hasEffectAppliedOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('hasEffectAppliedOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, includeDisabled] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.hasEffectAppliedOnToken(
      effectName,
      uuid,
      includeDisabled,
    );
    return result;
  },

  async hasEffectAppliedFromIdOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('hasEffectAppliedFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, includeDisabled] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.hasEffectAppliedFromIdOnToken(
      effectId,
      uuid,
      includeDisabled,
    );
    return result;
  },

  async addEffectOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw error('addEffectOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effect] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.addEffectOnToken(
      effectName,
      uuid,
      origin,
      overlay,
      effect,
    );
    return result;
  },

  async removeEffectOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffectOnToken(effectName, uuid);
    return result;
  },

  async removeEffectFromIdOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectFromIdOnToken | inAttributes must be of type array');
    }
    const [effectId, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffectFromIdOnToken(
      effectId,
      uuid,
    );
    return result;
  },

  async removeEffectFromIdOnTokenMultipleArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('removeEffectFromIdOnTokenMultipleArr | inAttributes must be of type array');
    }
    const [effectIds, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.removeEffectFromIdOnTokenMultiple(
      effectIds,
      uuid,
    );
    return result;
  },

  async toggleEffectFromIdOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw error('addEffectOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, alwaysDelete, forceEnabled, forceDisabled] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.toggleEffectFromIdOnToken(
      effectId,
      uuid,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
    );
    return result;
  },

  async findEffectByNameOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | null> {
    if (!Array.isArray(inAttributes)) {
      throw error('findEffectByNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.findEffectByNameOnToken(
      effectName,
      uuid,
    );
    return result;
  },

  async addActiveEffectOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw error('addActiveEffectOnTokenArr | inAttributes must be of type array');
    }
    const [tokenId, activeEffectData] = inAttributes;
    const result = (<EffectInterface>this.effectInterface)._effectHandler.addActiveEffectOnToken(
      <string>tokenId,
      activeEffectData,
    );
    return result;
  },

  async updateEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw error('updateEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.updateEffectFromIdOnToken(
      effectId,
      uuid,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateEffectFromNameOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw error('updateEffectFromNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effectUpdated] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.updateEffectFromNameOnToken(
      effectName,
      uuid,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateActiveEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw error('updateActiveEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.updateActiveEffectFromIdOnToken(
      effectId,
      uuid,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateActiveEffectFromNameOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw error('updateActiveEffectFromNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effectUpdated] = inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.updateActiveEffectFromNameOnToken(
      effectName,
      uuid,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  // ======================
  // Effect Actor Management
  // ======================

  async addEffectOnActor(actorId: string, effectName: string, effect: Effect) {
    const result = await (<EffectInterface>this.effectInterface).addEffectOnActor(effectName, <string>actorId, effect);
    return result;
  },

  async findEffectByNameOnActor(actorId: string, effectName: string): Promise<ActiveEffect | null> {
    const result = await (<EffectInterface>this.effectInterface).findEffectByNameOnActor(effectName, <string>actorId);
    return result;
  },

  async hasEffectAppliedOnActor(actorId: string, effectName: string, includeDisabled: boolean) {
    const result = (<EffectInterface>this.effectInterface).hasEffectAppliedOnActor(
      effectName,
      <string>actorId,
      includeDisabled,
    );
    return result;
  },

  async hasEffectAppliedFromIdOnActor(actorId: string, effectId: string, includeDisabled: boolean) {
    const result = (<EffectInterface>this.effectInterface).hasEffectAppliedFromIdOnActor(
      effectId,
      <string>actorId,
      includeDisabled,
    );
    return result;
  },

  async toggleEffectFromIdOnActor(
    actorId: string,
    effectId: string,
    alwaysDelete: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
  ) {
    const result = await (<EffectInterface>this.effectInterface).toggleEffectFromIdOnActor(
      effectId,
      <string>actorId,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
    );
    return result;
  },

  async addActiveEffectOnActor(actorId: string, activeEffectData: ActiveEffectData) {
    const result = (<EffectInterface>this.effectInterface).addActiveEffectOnActor(<string>actorId, activeEffectData);
    return result;
  },

  async removeEffectOnActor(actorId: string, effectName: string) {
    const result = await (<EffectInterface>this.effectInterface).removeEffectOnActor(effectName, <string>actorId);
    return result;
  },

  async removeEffectFromIdOnActor(actorId: string, effectId: string) {
    const result = await (<EffectInterface>this.effectInterface).removeEffectFromIdOnActor(effectId, <string>actorId);
    return result;
  },

  // ======================
  // Effect Token Management
  // ======================

  async addEffectOnToken(tokenId: string, effectName: string, effect: Effect) {
    const result = await (<EffectInterface>this.effectInterface).addEffectOnToken(effectName, <string>tokenId, effect);
    return result;
  },

  async findEffectByNameOnToken(tokenId: string, effectName: string): Promise<ActiveEffect | null> {
    const result = await (<EffectInterface>this.effectInterface).findEffectByNameOnToken(effectName, <string>tokenId);
    return result;
  },

  async hasEffectAppliedOnToken(tokenId: string, effectName: string, includeDisabled: boolean) {
    const result = (<EffectInterface>this.effectInterface).hasEffectAppliedOnToken(
      effectName,
      <string>tokenId,
      includeDisabled,
    );
    return result;
  },

  async hasEffectAppliedFromIdOnToken(tokenId: string, effectId: string, includeDisabled: boolean) {
    const result = (<EffectInterface>this.effectInterface).hasEffectAppliedFromIdOnToken(
      effectId,
      <string>tokenId,
      includeDisabled,
    );
    return result;
  },

  async toggleEffectFromIdOnToken(
    tokenId: string,
    effectId: string,
    alwaysDelete: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
  ) {
    const result = await (<EffectInterface>this.effectInterface).toggleEffectFromIdOnToken(
      effectId,
      <string>tokenId,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
    );
    return result;
  },

  async addActiveEffectOnToken(tokenId: string, activeEffectData: ActiveEffectData) {
    const result = await (<EffectInterface>this.effectInterface).addActiveEffectOnToken(
      <string>tokenId,
      activeEffectData,
    );
    return result;
  },

  async removeEffectOnToken(tokenId: string, effectName: string) {
    const result = await (<EffectInterface>this.effectInterface).removeEffectOnToken(effectName, <string>tokenId);
    return result;
  },

  async removeEffectFromIdOnToken(tokenId: string, effectId: string) {
    const result = await (<EffectInterface>this.effectInterface).removeEffectFromIdOnToken(effectId, <string>tokenId);
    return result;
  },

  async removeEffectFromIdOnTokenMultiple(tokenId: string, effectIds: string[]) {
    const result = await (<EffectInterface>this.effectInterface).removeEffectFromIdOnTokenMultiple(
      effectIds,
      <string>tokenId,
    );
    return result;
  },

  async updateEffectFromIdOnToken(tokenId: string, effectId: string, origin, overlay, effectUpdated: Effect) {
    const result = await (<EffectInterface>this.effectInterface).updateEffectFromIdOnToken(
      effectId,
      tokenId,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateEffectFromNameOnToken(tokenId: string, effectName: string, origin, overlay, effectUpdated: Effect) {
    const result = await (<EffectInterface>this.effectInterface).updateEffectFromNameOnToken(
      effectName,
      tokenId,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateActiveEffectFromIdOnToken(
    tokenId: string,
    effectId: string,
    origin,
    overlay,
    effectUpdated: ActiveEffectData,
  ) {
    const result = await (<EffectInterface>this.effectInterface).updateActiveEffectFromIdOnToken(
      effectId,
      tokenId,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  async updateActiveEffectFromNameOnToken(
    tokenId: string,
    effectName: string,
    origin,
    overlay,
    effectUpdated: ActiveEffectData,
  ) {
    const result = await (<EffectInterface>this.effectInterface).updateActiveEffectFromNameOnToken(
      effectName,
      tokenId,
      origin,
      overlay,
      effectUpdated,
    );
    return result;
  },

  // ======================
  // Effect Generic Management
  // ======================

  async onManageActiveEffectFromEffectId(
    effectActions: EffectActions,
    owner: Actor | Item,
    effectId: string,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ) {
    const result = await (<EffectInterface>this.effectInterface).onManageActiveEffectFromEffectId(
      effectActions,
      owner,
      effectId,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },

  async onManageActiveEffectFromEffectIdArr(...inAttributes) {
    const [effectActions, owner, effectId, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.onManageActiveEffectFromEffectId(
      effectActions,
      owner,
      effectId,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },

  async onManageActiveEffectFromEffect(
    effectActions: EffectActions,
    owner: Actor | Item,
    effect: Effect,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ) {
    const result = await (<EffectInterface>this.effectInterface).onManageActiveEffectFromEffect(
      effectActions,
      owner,
      effect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },

  async onManageActiveEffectFromEffectArr(...inAttributes) {
    const [effectActions, owner, effect, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.onManageActiveEffectFromEffect(
      effectActions,
      owner,
      effect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },

  async onManageActiveEffectFromActiveEffect(
    effectActions: EffectActions,
    owner: Actor | Item,
    activeEffect: ActiveEffect | null | undefined,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ) {
    const result = await (<EffectInterface>this.effectInterface).onManageActiveEffectFromActiveEffect(
      effectActions,
      owner,
      activeEffect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },

  async onManageActiveEffectFromActiveEffectArr(...inAttributes) {
    const [effectActions, owner, activeEffect, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    const result = await (<EffectInterface>this.effectInterface)._effectHandler.onManageActiveEffectFromActiveEffect(
      effectActions,
      owner,
      activeEffect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    return result;
  },
};

export default API;
