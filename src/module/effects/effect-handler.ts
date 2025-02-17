import { debugM, errorM, i18n, isStringEquals, logM, warnM } from './effect-log';
import FoundryHelpers from './foundry-helpers';
import Effect from './effect';
import type EmbeddedCollection from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/embedded-collection.mjs';
import type {
  ActiveEffectData,
  ActorData,
} from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/module.mjs';
import { EffectSupport } from './effect-support';
import type { EffectChangeData } from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/effectChangeData';
import type { EffectActions } from './effect-models';

export default class EffectHandler {
  moduleName: string;
  _foundryHelpers: FoundryHelpers;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
    this._foundryHelpers = new FoundryHelpers();
  }

  /**
   * Toggles an effect on or off by name on an actor by UUID
   *
   * @param {string} effectName - name of the effect to toggle
   * @param {string} overlay - name of the effect to toggle
   * @param {boolean} overlay- if the effect is with overlay on the token
   * @param {string[]} uuids - UUIDS of the actors to toggle the effect on
   * @param {object} metadata - additional contextual data for the application of the effect (likely provided by midi-qol)
   * @param {string} effectData - data of the effect to toggle (in this case is the add)
   */
  async toggleEffect(
    effectName: string,
    overlay: boolean,
    uuids: string[],
    metadata = undefined,
    effectData: Effect | undefined = undefined,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'toggleEffect' : [overlay=${overlay},uuids=${String(uuids)},metadata=${String(metadata)}]`,
    );
    const effectNames: string[] = [];
    for (const uuid of uuids) {
      if (this.hasEffectApplied(effectName, uuid)) {
        await this.removeEffect(effectName, uuid);
      } else {
        const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
        const origin = `Actor.${actor.id}`;
        await this.addEffect(effectName, <Effect>effectData, uuid, origin, overlay, metadata);
      }
    }
    debugM(
      this.moduleName,
      `END Effect Handler 'toggleEffect' : [overlay=${overlay},effectNames=${String(effectNames)},metadata=${String(
        metadata,
      )}]`,
    );
    return true;
  }

  /**
   * Toggles an effect on or off by name on an actor by UUID
   *
   * @param {string} effectName - name of the effect to toggle
   * @param {object} params - the effect parameters
   * @param {string} params.overlay - name of the effect to toggle
   * @param {string[]} params.uuids - UUIDS of the actors to toggle the effect on
   */
  async toggleEffectArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'toggleEffectArr | inAttributes must be of type array');
    }
    const [effectName, overlay, uuids, metadata, effectData] = inAttributes;
    return this.toggleEffect(effectName, overlay, uuids, metadata, effectData);
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is
   * applied to
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectApplied(effectName: string, uuid: string): boolean {
    debugM(
      this.moduleName,
      `START Effect Handler 'hasEffectApplied' : [effectName=${effectName},uuid=${String(uuid)}]`,
    );
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const isApplied = actor?.data?.effects?.some(
      // (activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect?.data?.label == effectName,
      (activeEffect) => {
        if (isStringEquals(activeEffect?.data?.label, effectName) && !activeEffect?.data?.disabled) {
          return true;
        } else {
          return false;
        }
      },
    );
    debugM(
      this.moduleName,
      `END Effect Handler 'hasEffectApplied' : [effectName=${effectName},actorName=${String(actor.name)}]`,
    );
    return isApplied;
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is
   * applied to
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedArr(...inAttributes: any[]): boolean {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'hasEffectAppliedArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.hasEffectApplied(effectName, uuid);
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffect(effectName: string, uuid: string): Promise<ActiveEffect | undefined> {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const effectToRemove = actor.data.effects.find(
      //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && activeEffect?.data?.label == effectName,
      (activeEffect) => activeEffect?.data?.label === effectName,
    );

    if (!effectToRemove) {
      debugM(this.moduleName, `Can't find effect to remove with name ${effectName} from ${actor.name} - ${actor.id}`);
      return undefined;
    }
    const activeEffectsRemoved = <ActiveEffect[]>(
      await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id])
    );
    logM(this.moduleName, `Removed effect ${effectName} from ${actor.name} - ${actor.id}`);
    return activeEffectsRemoved[0];
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.removeEffect(effectName, uuid);
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {string} effectName - the name of the effect to add
   * @param {object} effectData - the effect data to add if effectName is not provided
   * @param {string} uuid - the uuid of the actor to add the effect to
   * @param {string} origin - the origin of the effect
   * @param {boolean} overlay - if the effect is an overlay or not
   * @param {object} metadata - additional contextual data for the application of the effect (likely provided by midi-qol)
   */
  async addEffect(
    effectName: string | undefined | null,
    effectData: Effect,
    uuid: string,
    origin: string,
    overlay = false,
    metadata = undefined,
  ): Promise<ActiveEffect | undefined> {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    let effect = <Effect>this._findEffectByName(effectName, actor);

    if (!effect && effectData) {
      effect = new Effect(effectData);
    }

    if (!origin) {
      origin = `Actor.${actor.id}`;
    }

    this._handleIntegrations(effect);

    effect.origin = effectData.origin ? effectData.origin : origin;
    effect.overlay = effectData.overlay ? effectData.overlay : overlay;
    const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnActor(effectName, uuid);
    if (activeEffectFounded) {
      warnM(
        this.moduleName,
        `Can't add the effect with name ${effectName} on actor ${actor.name}, because is already added`,
      );
      return undefined;
    }
    const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
    const activeEffectsAdded = <ActiveEffect[]>await actor.createEmbeddedDocuments('ActiveEffect', [activeEffectData]);
    logM(this.moduleName, `Added effect ${effect.name} to ${actor.name} - ${actor.id}`);
    return activeEffectsAdded[0];
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {object} params - the effect parameters
   * @param {string} params.effectName - the name of the effect to add
   * @param {string} params.uuid - the uuid of the actor to add the effect to
   * @param {string} params.origin - the origin of the effect
   * @param {boolean} params.overlay - if the effect is an overlay or not
   */
  async addEffectArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addEffectArr | inAttributes must be of type array');
    }
    const [effectName, effectData, uuid, origin, overlay, metadata] = inAttributes;
    return this.addEffect(effectName, effectData, uuid, origin, overlay, metadata);
  }

  _handleIntegrations(effect: Effect): EffectChangeData[] {
    return EffectSupport._handleIntegrations(effect);
  }

  // ============================================================
  // Additional feature for retrocompatibility
  // ============================================================

  /**
   * Searches through the list of available effects and returns one matching the
   * effect name. Prioritizes finding custom effects first.
   *
   * @param {string} effectName - the effect name to search for
   * @returns {Effect} the found effect
   */
  _findEffectByName(effectName: string | undefined | null, actor: Actor): Effect | undefined {
    if (!effectName) {
      return undefined;
    }

    let effect: Effect | undefined;
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    for (const effectEntity of actorEffects) {
      const effectNameToSet = effectEntity.name ? effectEntity.name : effectEntity.data.label;
      if (!effectNameToSet) {
        continue;
      }
      if (isStringEquals(effectNameToSet, effectName)) {
        effect = EffectSupport.convertActiveEffectToEffect(effectEntity);
      }
    }

    return effect;
  }

  // convertToEffectClass(effect: ActiveEffect): Effect {
  //   const atlChanges = effect.data.changes.filter((changes) => changes.key.startsWith('ATL'));
  //   const tokenMagicChanges = effect.data.changes.filter((changes) => changes.key === 'macro.tokenMagic');
  //   const changes = effect.data.changes.filter(
  //     (change) => !change.key.startsWith('ATL') && change.key !== 'macro.tokenMagic',
  //   );

  //   return new Effect({
  //     customId: <string>effect.id,
  //     name: effect.data.label,
  //     description: <string>effect.data.flags.customEffectDescription,
  //     icon: <string>effect.data.icon,
  //     tint: <string>effect.data.tint,
  //     seconds: effect.data.duration.seconds,
  //     rounds: effect.data.duration.rounds,
  //     turns: effect.data.duration.turns,
  //     flags: effect.data.flags,
  //     changes,
  //     atlChanges,
  //     tokenMagicChanges,
  //   });
  // }

  // ====================================================================
  // ACTOR MANAGEMENT
  // ====================================================================

  /**
   * Searches through the list of available effects and returns one matching the
   * effect name. Prioritizes finding custom effects first.
   *
   * @param {string} effectName - the effect name to search for
   * @returns {Effect} the found effect
   */
  async findEffectByNameOnActor(
    effectName: string | undefined | null,
    uuid: string,
  ): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    let effect: ActiveEffect | null | undefined = undefined;
    if (!effectName) {
      return effect;
    }
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    for (const effectEntity of actorEffects) {
      const effectNameToSet = effectEntity.name ? effectEntity.name : effectEntity.data.label;
      if (!effectNameToSet) {
        continue;
      }
      if (isStringEquals(effectNameToSet, effectName)) {
        effect = effectEntity;
        break;
      }
    }
    return effect;
  }

  /**
   * Searches through the list of available effects and returns one matching the
   * effect name. Prioritizes finding custom effects first.
   *
   * @param {string} effectName - the effect name to search for
   * @returns {Effect} the found effect
   */
  async findEffectByNameOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | null | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'findEffectByNameOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.findEffectByNameOnActor(effectName, uuid);
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedOnActor(effectName: string, uuid: string, includeDisabled = false): boolean {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (isStringEquals(activeEffect?.data?.label, effectName)) {
          return true;
        } else {
          return false;
        }
      } else {
        if (isStringEquals(activeEffect?.data?.label, effectName) && !activeEffect?.data?.disabled) {
          return true;
        } else {
          return false;
        }
      }
    });
    return isApplied;
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedOnActorArr(...inAttributes: any[]): boolean {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'hasEffectAppliedOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid, includeDisabled] = inAttributes;
    return this.hasEffectAppliedOnActor(effectName, uuid, includeDisabled);
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectId - the id of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedFromIdOnActor(effectId: string, uuid: string, includeDisabled = false): boolean {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects ?? [];
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (<string>activeEffect?.id === effectId) {
          return true;
        } else {
          return false;
        }
      } else {
        if (<string>activeEffect?.id === effectId && !activeEffect.data.disabled) {
          return true;
        } else {
          return false;
        }
      }
    });
    return isApplied;
  }

  /**
   * Checks to see if any of the current active effects applied to the actor
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectId - the id of the effect to check
   * @param {string} uuid - the uuid of the actor to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedFromIdOnActorArr(...inAttributes: any[]): boolean {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'hasEffectAppliedFromIdOnActorArr | inAttributes must be of type array');
    }
    const [effectId, uuid, includeDisabled] = inAttributes;
    return this.hasEffectAppliedFromIdOnActor(effectId, uuid, includeDisabled);
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectOnActor(effectName: string, uuid: string): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const effectToRemove = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?.label === effectName)
    );

    if (!effectToRemove) {
      debugM(this.moduleName, `Can't find effect to remove with name ${effectName} from ${actor.name} - ${actor.id}`);
      return undefined;
    }
    // actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    // Why i need this ??? for avoid the double AE
    // await effectToRemove.update({ disabled: true });
    // await effectToRemove.delete();
    const activeEffectsRemoved = <ActiveEffect[]>(
      await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id])
    );
    logM(this.moduleName, `Removed effect ${effectName} from ${actor.name} - ${actor.id}`);
    return activeEffectsRemoved[0];
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.removeEffectOnActor(effectName, uuid);
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectFromIdOnActor(effectId: string, uuid: string): Promise<ActiveEffect | undefined> {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    if (effectId) {
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
      //actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemoveId]);
      // Why i need this ??? for avoid the double AE
      const effectToRemove = <ActiveEffect>actorEffects.find((activeEffect) => <string>activeEffect.id === effectId);
      if (!effectToRemove) {
        debugM(this.moduleName, `Can't find effect to remove with id ${effectId} from ${actor.name} - ${actor.id}`);
        return undefined;
      }
      // await effectToRemove.update({ disabled: true });
      // await effectToRemove.delete();
      const activeEffectsRemoved = <ActiveEffect[]>(
        await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id])
      );
      logM(this.moduleName, `Removed effect ${effectToRemove?.data?.label} from ${actor.name} - ${actor.id}`);
      return activeEffectsRemoved[0];
    } else {
      debugM(this.moduleName, `Can't removed effect without id from ${actor.name} - ${actor.id}`);
      return undefined;
    }
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectFromIdOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectFromIdOnActor | inAttributes must be of type array');
    }
    const [effectId, uuid] = inAttributes;
    return this.removeEffectFromIdOnActor(effectId, uuid);
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {object} params - the effect parameters
   * @param {string} params.effectName - the name of the effect to add
   * @param {string} params.uuid - the uuid of the actor to add the effect to
   * @param {string} params.origin - the origin of the effect
   * @param {boolean} params.overlay - if the effect is an overlay or not
   */
  async addEffectOnActor(
    effectName: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effect: Effect | null | undefined,
  ): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    if (effect) {
      const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
      if (!origin) {
        origin = `Actor.${actor.id}`;
      }
      // const activeEffectData = effect.convertToActiveEffectData({
      //   origin,
      //   overlay,
      // });
      effect.origin = effect.origin ? effect.origin : origin;
      effect.overlay = effect.overlay ? effect.overlay : overlay;
      const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnActor(effectName, uuid);
      if (activeEffectFounded) {
        warnM(
          this.moduleName,
          `Can't add the effect with name ${effectName} on actor ${actor.name}, because is already added`,
        );
        return undefined;
      }
      const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
      const activeEffectsAdded = <ActiveEffect[]>(
        await actor.createEmbeddedDocuments('ActiveEffect', [activeEffectData])
      );
      logM(this.moduleName, `Added effect ${effect.name ? effect.name : effectName} to ${actor.name} - ${actor.id}`);
      return activeEffectsAdded[0];
    }
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {string} effectName - the name of the effect to add
   * @param {string} uuid - the uuid of the actor to add the effect to
   */
  async addEffectOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addEffectOnActorArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effect] = inAttributes;
    return this.addEffectOnActor(effectName, uuid, origin, overlay, effect);
  }

  /**
   * @href https://github.com/ElfFriend-DnD/foundryvtt-temp-effects-as-statuses/blob/main/scripts/temp-effects-as-statuses.js
   */
  async toggleEffectFromIdOnActor(
    effectId: string,
    uuid: string,
    alwaysDelete: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
  ): Promise<boolean | undefined> {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const activeEffect = <ActiveEffect>actorEffects.find((entity: ActiveEffect) => {
      return <string>entity.id === effectId;
    });
    // nuke it if it has a statusId
    // brittle assumption
    // provides an option to always do this
    // if (activeEffect.getFlag('core', 'statusId') || alwaysDelete) {
    if (alwaysDelete) {
      const deleted = await activeEffect.delete();
      return !!deleted;
    }
    let updated;
    if (forceEnabled && activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: false,
      });
    } else if (forceDisabled && !activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: true,
      });
    } else {
      // otherwise toggle its disabled status
      updated = await activeEffect.update({
        disabled: !activeEffect.data.disabled,
      });
    }

    return !!updated;
  }

  async toggleEffectFromIdOnActorArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'toggleEffectFromIdOnActorArr | inAttributes must be of type array');
    }
    const [effectId, uuid, alwaysDelete, forceEnabled, forceDisabled] = inAttributes;
    return this.toggleEffectFromIdOnActor(effectId, uuid, alwaysDelete, forceEnabled, forceDisabled);
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {string} uuid - the uuid of the actor to add the effect to
   * @param {string} activeEffectData - the name of the effect to add
   */
  async addActiveEffectOnActor(uuid: string, activeEffectData: ActiveEffectData): Promise<ActiveEffect | undefined> {
    if (activeEffectData) {
      const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
      if (!activeEffectData.origin) {
        activeEffectData.origin = `Actor.${actor.id}`;
      }
      const activeEffectsAdded = <ActiveEffect[]>(
        await actor.createEmbeddedDocuments('ActiveEffect', [<Record<string, any>>activeEffectData])
      );
      logM(this.moduleName, `Added effect ${activeEffectData.label} to ${actor.name} - ${actor.id}`);
      return activeEffectsAdded[0];
    } else {
      return undefined;
    }
  }

  async addActiveEffectOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addActiveEffectOnActorArr | inAttributes must be of type array');
    }
    const [uuid, activeEffectData] = inAttributes;
    return this.addActiveEffectOnActor(uuid, activeEffectData);
  }

  // ====================================================================
  // TOKEN MANAGEMENT
  // ====================================================================

  /**
   * Searches through the list of available effects and returns one matching the
   * effect name. Prioritizes finding custom effects first.
   *
   * @param {string} effectName - the effect name to search for
   * @returns {Effect} the found effect
   */
  async findEffectByNameOnToken(effectName: string, uuid: string): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    let effect: ActiveEffect | undefined = undefined;
    if (!effectName) {
      return effect;
    }
    for (const effectEntity of actorEffects) {
      //@ts-ignore
      const effectNameToSet = effectEntity.data ? effectEntity.data.label : effectEntity.label;
      if (!effectNameToSet) {
        continue;
      }
      if (isStringEquals(effectNameToSet, effectName)) {
        effect = effectEntity;
        break;
      }
    }
    return effect;
  }

  /**
   * Searches through the list of available effects and returns one matching the
   * effect name. Prioritizes finding custom effects first.
   *
   * @param {string} effectName - the effect name to search for
   * @returns {Effect} the found effect
   */
  async findEffectByNameOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'findEffectByNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.findEffectByNameOnToken(effectName, uuid);
  }

  /**
   * Checks to see if any of the current active effects applied to the token
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the token to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedOnToken(effectName: string, uuid: string, includeDisabled = false): boolean {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const token = this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (isStringEquals(activeEffect?.data.label, effectName)) {
          return true;
        } else {
          return false;
        }
      } else {
        if (isStringEquals(activeEffect?.data.label, effectName) && !activeEffect.data.disabled) {
          return true;
        } else {
          return false;
        }
      }
    });
    return isApplied;
  }

  /**
   * Checks to see if any of the current active effects applied to the token
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectName - the name of the effect to check
   * @param {string} uuid - the uuid of the token to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedOnTokenArr(...inAttributes: any[]): boolean {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'hasEffectAppliedOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, includeDisabled] = inAttributes;
    return this.hasEffectAppliedOnToken(effectName, uuid, includeDisabled);
  }

  /**
   * Checks to see if any of the current active effects applied to the token
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectId - the id of the effect to check
   * @param {string} uuid - the uuid of the token to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedFromIdOnToken(effectId: string, uuid: string, includeDisabled = false): boolean {
    const token = this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects ?? [];
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (activeEffect.data._id === effectId) {
          return true;
        } else {
          return false;
        }
      } else {
        if (activeEffect.data._id === effectId && !activeEffect.data.disabled) {
          return true;
        } else {
          return false;
        }
      }
    });
    return isApplied;
  }

  /**
   * Checks to see if any of the current active effects applied to the token
   * with the given UUID match the effect name and are a convenient effect
   *
   * @param {string} effectId - the id of the effect to check
   * @param {string} uuid - the uuid of the token to see if the effect is applied to
   * @param {string} includeDisabled - if true include the applied disabled effect
   * @returns {boolean} true if the effect is applied, false otherwise
   */
  hasEffectAppliedFromIdOnTokenArr(...inAttributes: any[]): boolean {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'hasEffectAppliedFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, includeDisabled] = inAttributes;
    return this.hasEffectAppliedFromIdOnToken(effectId, uuid, includeDisabled);
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectOnToken(effectName: string, uuid: string): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const token = this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effectToRemove = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?.label === effectName)
    );

    if (!effectToRemove) {
      debugM(this.moduleName, `Can't find effect to remove with name ${effectName} from ${token.name} - ${token.id}`);
      return undefined;
    }
    // token.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    // Why i need this ??? for avoid the double AE
    // await effectToRemove.update({ disabled: true });
    // await effectToRemove.delete();
    const activeEffectsRemoved = <ActiveEffect[]>(
      await token.actor?.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id])
    );
    logM(this.moduleName, `Removed effect ${effectName} from ${token.name} - ${token.id}`);
    return activeEffectsRemoved[0];
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid] = inAttributes;
    return this.removeEffectOnToken(effectName, uuid);
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectFromIdOnToken(effectId: string, uuid: string): Promise<ActiveEffect | undefined> {
    if (effectId) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
      const effectToRemove = <ActiveEffect>actorEffects.find(
        //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
        (activeEffect) => <string>activeEffect?.data?._id === effectId,
      );
      if (effectToRemove) {
        // await effectToRemove.update({ disabled: true });
        // await effectToRemove.delete();
        const activeEffectsRemoved = <ActiveEffect[]>(
          await token.actor?.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id])
        );
        logM(this.moduleName, `Removed effect ${effectToRemove?.data?.label} from ${token.name} - ${token.id}`);
        return activeEffectsRemoved[0];
      }
    }
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid] = inAttributes;
    return this.removeEffectFromIdOnToken(effectId, uuid);
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectFromIdOnTokenMultiple(effectIds: string[], uuid: string): Promise<ActiveEffect | undefined> {
    if (effectIds) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      const effectIdsTmp: string[] = [];
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
      for (const effectIdTmp of effectIds) {
        const effectToRemove = <ActiveEffect>(
          actorEffects.find((activeEffect) => <string>activeEffect?.data?._id === effectIdTmp)
        );
        if (effectToRemove) {
          effectIdsTmp.push(effectIdTmp);
        }
      }
      // const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
      // const effectToRemove = <ActiveEffect>actorEffects.find(
      //   //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
      //   (activeEffect) => <string>activeEffect?.data?._id == effectId,
      // );
      // await effectToRemove.update({ disabled: true });
      // await effectToRemove.delete();
      const activeEffectsRemoved = <ActiveEffect[]>(
        await token.actor?.deleteEmbeddedDocuments('ActiveEffect', effectIdsTmp)
      );
      logM(this.moduleName, `Removed effect ${effectIds.join(',')} from ${token.name} - ${token.id}`);
      return activeEffectsRemoved[0];
    }
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectFromIdOnTokenMultipleArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'removeEffectFromIdOnTokenMultipleArr | inAttributes must be of type array');
    }
    const [effectIds, uuid] = inAttributes;
    return this.removeEffectFromIdOnTokenMultiple(effectIds, uuid);
  }

  /**
   * Adds the effect with the provided name to an token matching the provided
   * UUID
   *
   * @param {object} params - the effect parameters
   * @param {string} params.effectName - the name of the effect to add
   * @param {string} params.uuid - the uuid of the token to add the effect to
   * @param {string} params.origin - the origin of the effect
   * @param {boolean} params.overlay - if the effect is an overlay or not
   */
  async addEffectOnToken(
    effectName: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effect: Effect | null | undefined,
  ): Promise<ActiveEffect | undefined> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    if (effect) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      if (!origin) {
        const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
        // origin = `Scene.${sceneId}.Token.${token.id}`;
        origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
      }
      // const activeEffectData = effect.convertToActiveEffectData({
      //   origin,
      //   overlay,
      // });
      effect.origin = effect.origin ? effect.origin : origin;
      effect.overlay = effect.overlay ? effect.overlay : overlay;
      const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnToken(effectName, uuid);
      if (activeEffectFounded) {
        warnM(
          this.moduleName,
          `Can't add the effect with name ${effectName} on token ${token.name}, because is already added`,
        );
        return activeEffectFounded;
      }
      const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
      const activeEffectsAdded = <ActiveEffect[]>(
        await token.actor?.createEmbeddedDocuments('ActiveEffect', [activeEffectData])
      );
      logM(this.moduleName, `Added effect ${effect.name ? effect.name : effectName} to ${token.name} - ${token.id}`);
      return activeEffectsAdded[0];
    }
  }

  /**
   * Adds the effect with the provided name to an token matching the provided
   * UUID
   *
   * @param {string} effectName - the name of the effect to add
   * @param {string} uuid - the uuid of the token to add the effect to
   */
  async addEffectOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addEffectOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effect] = inAttributes;
    return this.addEffectOnToken(effectName, uuid, origin, overlay, effect);
  }

  /**
   * @href https://github.com/ElfFriend-DnD/foundryvtt-temp-effects-as-statuses/blob/main/scripts/temp-effects-as-statuses.js
   */
  async toggleEffectFromIdOnToken(
    effectId: string,
    uuid: string,
    alwaysDelete: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'toggleEffectFromIdOnToken' : [effectId=${effectId},uuid=${uuid},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>actorEffects.find(
      //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
      (activeEffect) => <string>activeEffect?.data?._id === effectId,
    );

    if (!activeEffect) {
      return undefined;
    }
    // nuke it if it has a statusId
    // brittle assumption
    // provides an option to always do this
    // if (activeEffect.getFlag('core', 'statusId') || alwaysDelete) {
    if (alwaysDelete) {
      const deleted = await activeEffect.delete();
      return !!deleted;
    }
    let updated;
    if (forceEnabled && activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: false,
      });
    } else if (forceDisabled && !activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: true,
      });
    } else {
      // otherwise toggle its disabled status
      updated = await activeEffect.update({
        disabled: !activeEffect.data.disabled,
      });
    }
    debugM(
      this.moduleName,
      `END Effect Handler 'toggleEffectFromIdOnToken' : [effectName=${activeEffect.name},tokenName=${token.name},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    return !!updated;
  }

  /**
   * @href https://github.com/ElfFriend-DnD/foundryvtt-temp-effects-as-statuses/blob/main/scripts/temp-effects-as-statuses.js
   */
  async toggleEffectFromDataOnToken(
    effect: Effect,
    uuid: string,
    alwaysDelete: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'toggleEffectFromIdOnToken' : [effect=${effect},uuid=${uuid},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>actorEffects.find(
      //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
      (activeEffect) => {
        return (
          isStringEquals(<string>activeEffect?.data?._id, effect.customId) ||
          isStringEquals(<string>activeEffect?.data?.label, effect.name)
        );
      },
    );

    if (!activeEffect) {
      return undefined;
    }
    // nuke it if it has a statusId
    // brittle assumption
    // provides an option to always do this
    // if (activeEffect.getFlag('core', 'statusId') || alwaysDelete) {
    if (alwaysDelete) {
      const deleted = await activeEffect.delete();
      return !!deleted;
    }
    let updated;
    if (forceEnabled && activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: false,
      });
    } else if (forceDisabled && !activeEffect.data.disabled) {
      updated = await activeEffect.update({
        disabled: true,
      });
    } else {
      // otherwise toggle its disabled status
      updated = await activeEffect.update({
        disabled: !activeEffect.data.disabled,
      });
    }
    debugM(
      this.moduleName,
      `END Effect Handler 'toggleEffectFromIdOnToken' : [effectName=${activeEffect.name},tokenName=${token.name},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    return !!updated;
  }

  async toggleEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'toggleEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, alwaysDelete, forceEnabled, forceDisabled] = inAttributes;
    return this.toggleEffectFromIdOnToken(effectId, uuid, alwaysDelete, forceEnabled, forceDisabled);
  }

  /**
   * Adds the effect with the provided name to an token matching the provided
   * UUID
   *
   * @param {string} uuid - the uuid of the token to add the effect to
   * @param {string} activeEffectData - the name of the effect to add
   */
  async addActiveEffectOnToken(uuid: string, activeEffectData: ActiveEffectData): Promise<ActiveEffect | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'addActiveEffectOnToken' : [uuid=${uuid},activeEffectData=${activeEffectData}]`,
    );
    if (activeEffectData) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      if (!activeEffectData.origin) {
        const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
        // const origin = `Scene.${sceneId}.Token.${token.id}`
        const origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
        activeEffectData.origin = origin;
      }
      const activeEffetsAdded = <ActiveEffect[]>(
        await token.actor?.createEmbeddedDocuments('ActiveEffect', [<Record<string, any>>activeEffectData])
      );
      logM(this.moduleName, `Added effect ${activeEffectData.label} to ${token.name} - ${token.id}`);
      return activeEffetsAdded[0];
    }
    debugM(
      this.moduleName,
      `END Effect Handler 'addActiveEffectOnToken' : [uuid=${uuid},activeEffectData=${activeEffectData}]`,
    );
  }

  async addActiveEffectOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addActiveEffectOnTokenArr | inAttributes must be of type array');
    }
    const [uuid, activeEffectData] = inAttributes;
    return this.addActiveEffectOnToken(uuid, activeEffectData);
  }

  async updateEffectFromIdOnToken(
    effectId: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effectUpdated: Effect,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'updateEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?._id === effectId)
    );

    if (!activeEffect) {
      return undefined;
    }
    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    // const activeEffectDataUpdated = effectUpdated.convertToActiveEffectData({
    //   origin,
    //   overlay,
    // });
    effectUpdated.origin = origin;
    effectUpdated.overlay = overlay;
    const activeEffectDataUpdated = EffectSupport.convertToActiveEffectData(effectUpdated);
    activeEffectDataUpdated._id = activeEffect.id;
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName, `Updated effect ${activeEffect.data.label} to ${token.name} - ${token.id}`);
    debugM(
      this.moduleName,
      `END Effect Handler 'updateEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'updateEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateEffectFromIdOnToken(effectId, uuid, origin, overlay, effectUpdated);
  }

  async updateEffectFromNameOnToken(
    effectName: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effectUpdated: Effect,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'updateEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>(
      actorEffects.find((activeEffect) => isStringEquals(<string>activeEffect?.data?.label, effectName))
    );

    if (!activeEffect) {
      return undefined;
    }
    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    // const activeEffectDataUpdated = effectUpdated.convertToActiveEffectData({
    //   origin,
    //   overlay,
    // });
    effectUpdated.origin = origin;
    effectUpdated.overlay = overlay;
    const activeEffectDataUpdated = EffectSupport.convertToActiveEffectData(effectUpdated);
    activeEffectDataUpdated._id = activeEffect.id;
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName, `Updated effect ${activeEffect.data.label} to ${token.name} - ${token.id}`);
    debugM(
      this.moduleName,
      `END Effect Handler 'updateEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateEffectFromNameOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'updateEffectFromNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateEffectFromNameOnToken(effectName, uuid, origin, overlay, effectUpdated);
  }

  async updateActiveEffectFromIdOnToken(
    effectId: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effectUpdated: ActiveEffectData,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'updateActiveEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?._id === effectId)
    );

    if (!activeEffect) {
      return undefined;
    }
    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    const activeEffectDataUpdated = effectUpdated;
    // if(origin) activeEffectDataUpdated.origin = origin;
    // if(overlay) activeEffectDataUpdated.overlay = overlay;
    activeEffectDataUpdated._id = activeEffect.id;
    //@ts-ignore
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName, `Updated effect ${activeEffect.data.label} to ${token.name} - ${token.id}`);
    debugM(
      this.moduleName,
      `END Effect Handler 'updateActiveEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateActiveEffectFromIdOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'updateActiveEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateActiveEffectFromIdOnToken(effectId, uuid, origin, overlay, effectUpdated);
  }

  async updateActiveEffectFromNameOnToken(
    effectName: string,
    uuid: string,
    origin: string,
    overlay: boolean,
    effectUpdated: ActiveEffectData,
  ): Promise<boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'updateActiveEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const activeEffect = <ActiveEffect>(
      actorEffects.find((activeEffect) => isStringEquals(<string>activeEffect?.data?.label, effectName))
    );

    if (!activeEffect) {
      return undefined;
    }
    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    const activeEffectDataUpdated = effectUpdated;
    // if(origin) activeEffectDataUpdated.origin = origin;
    // if(overlay) activeEffectDataUpdated.overlay = overlay;
    activeEffectDataUpdated._id = activeEffect.id;
    //@ts-ignore
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName, `Updated effect ${activeEffect.data.label} to ${token.name} - ${token.id}`);
    debugM(
      this.moduleName,
      `END Effect Handler 'updateActiveEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateActiveEffectFromNameOnTokenArr(...inAttributes: any[]): Promise<boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'updateActiveEffectFromNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateEffectFromNameOnToken(effectName, uuid, origin, overlay, effectUpdated);
  }

  // ========================================================
  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event      The left-click event on the effect control
   * @param {Actor|Item} owner      The owning document which manages this effect
   * @returns {Promise|null}        Promise that resolves when the changes are complete.
   */
  async onManageActiveEffectFromEffectId(
    effectActions: EffectActions,
    owner: Actor | Item,
    effectId: string,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ): Promise<Item | ActiveEffect | boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'onManageActiveEffectFromEffectId' : [effectActions=${effectActions}, owner=${owner.data}, effectId=${effectId},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    const actorEffects = owner?.data.effects;
    const activeEffect = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?._id === effectId)
    );
    const response = this.onManageActiveEffectFromActiveEffect(
      effectActions,
      owner,
      activeEffect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    debugM(
      this.moduleName,
      `END Effect Handler 'onManageActiveEffectFromEffectId' : [effectActions=${effectActions}, owner=${owner.data}, effectId=${effectId},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    return response;
  }

  async onManageActiveEffectFromEffectIdArr(
    ...inAttributes: any[]
  ): Promise<Item | ActiveEffect | boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'onManageActiveEffectFromEffectIdArr | inAttributes must be of type array');
    }
    const [effectActions, owner, effectId, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    return this.onManageActiveEffectFromEffectId(
      effectActions,
      owner,
      effectId,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
  }

  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event      The left-click event on the effect control
   * @param {Actor|Item} owner      The owning document which manages this effect
   * @returns {Promise|null}        Promise that resolves when the changes are complete.
   */
  async onManageActiveEffectFromEffect(
    effectActions: EffectActions,
    owner: Actor | Item,
    effect: Effect,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ): Promise<Item | ActiveEffect | boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'onManageActiveEffectFromEffect' : [effectActions=${effectActions}, owner=${owner.data}, effect=${effect},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    const activeEffect = effect.name ? owner.effects.getName(i18n(effect.name)) : null;
    const response = this.onManageActiveEffectFromActiveEffect(
      effectActions,
      owner,
      activeEffect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
    debugM(
      this.moduleName,
      `END Effect Handler 'onManageActiveEffectFromEffect' : [effectActions=${effectActions}, owner=${owner.data}, effect=${effect},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    return response;
  }

  async onManageActiveEffectFromEffectArr(...inAttributes: any[]): Promise<Item | ActiveEffect | boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'onManageActiveEffectFromEffectArr | inAttributes must be of type array');
    }
    const [effectActions, owner, effect, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    return this.onManageActiveEffectFromEffect(
      effectActions,
      owner,
      effect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
  }

  /**
   * Manage Active Effect instances through the Actor Sheet via effect control buttons.
   * @param {MouseEvent} event      The left-click event on the effect control
   * @param {Actor|Item} owner      The owning document which manages this effect
   * @returns {Promise|null}        Promise that resolves when the changes are complete.
   */
  async onManageActiveEffectFromActiveEffect(
    effectActions: EffectActions,
    owner: Actor | Item,
    activeEffect: ActiveEffect | null | undefined | undefined,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ): Promise<Item | ActiveEffect | boolean | undefined> {
    debugM(
      this.moduleName,
      `START Effect Handler 'onManageActiveEffectFromActiveEffect' : [effectActions=${effectActions}, owner=${owner.data}, activeEffect=${activeEffect},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    switch (effectActions) {
      case 'update': {
        if (!activeEffect) {
          warnM(this.moduleName, `Can't retrieve effect to update`);
          return undefined;
        }
        if (owner instanceof Actor) {
          const actor = owner;
          if (!(<ActiveEffect>activeEffect).data.origin) {
            const origin = `Actor.${actor?.id}`;
            setProperty(<ActiveEffectData>activeEffect?.data, 'origin', origin);
          }
          const activeEffectsUpdated = <ActiveEffect[]>(
            await actor?.updateEmbeddedDocuments('ActiveEffect', [<any>activeEffect?.data])
          );
          return activeEffectsUpdated[0];
        } else if (owner instanceof Item) {
          const item = owner;
          const itemUpdated = <Item>await item.update({
            effects: [activeEffect?.data],
          });
          return itemUpdated;
        }
        return undefined;
      }
      case 'create': {
        if (!activeEffect) {
          warnM(this.moduleName, `Can't retrieve effect to create`);
          return undefined;
        }
        if (owner instanceof Actor) {
          const actor = owner;
          if (!(<ActiveEffect>activeEffect).data.origin) {
            const origin = `Actor.${actor?.id}`;
            setProperty(<ActiveEffectData>activeEffect?.data, 'origin', origin);
          }
          const activeEffectsAdded = <ActiveEffect[]>(
            await actor?.createEmbeddedDocuments('ActiveEffect', [<any>activeEffect?.data])
          );
          return activeEffectsAdded[0];
        } else if (owner instanceof Item) {
          const item = owner;
          const itemUpdated = await item.update({
            effects: [activeEffect?.data],
          });
          return itemUpdated;
        }
        return undefined;
      }
      // case 'create': {
      //   return owner.createEmbeddedDocuments('ActiveEffect', [
      //     {
      //       label: game.i18n.localize('DND5E.EffectNew'),
      //       icon: 'icons/svg/aura.svg',
      //       origin: owner.uuid,
      //       'duration.rounds': isTemporary ? 1 : undefined,
      //       disabled: isDisabled,
      //     },
      //   ]);
      // }
      case 'edit': {
        if (!activeEffect) {
          warnM(this.moduleName, `Can't retrieve effect to edit`);
          return undefined;
        }
        activeEffect?.sheet?.render(true);
        return true;
      }
      case 'delete': {
        if (!activeEffect) {
          warnM(this.moduleName, `Can't retrieve effect to delete`);
          return undefined;
        }
        const activeEffectDeleted = <ActiveEffect>await activeEffect?.delete();
        return activeEffectDeleted;
      }
      case 'toggle': {
        if (!activeEffect) {
          warnM(this.moduleName, `Can't retrieve effect to toogle`);
        }
        if (activeEffect?.getFlag('core', 'statusId') || alwaysDelete) {
          const deleted = await activeEffect?.delete();
          return !!deleted;
        }
        let updated;
        if (forceEnabled && activeEffect?.data.disabled) {
          updated = await activeEffect?.update({
            disabled: false,
          });
        } else if (forceDisabled && !activeEffect?.data.disabled) {
          updated = await activeEffect?.update({
            disabled: true,
          });
        } else {
          // otherwise toggle its disabled status
          updated = await activeEffect?.update({
            disabled: !activeEffect?.data.disabled,
          });
        }
        return updated;
        // return activeEffect?.update({disabled: !activeEffect.data.disabled});
      }
    }
  }

  async onManageActiveEffectFromActiveEffectArr(
    ...inAttributes: any[]
  ): Promise<Item | ActiveEffect | boolean | undefined> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'onManageActiveEffectFromActiveEffectArr | inAttributes must be of type array');
    }
    const [effectActions, owner, activeEffect, alwaysDelete, forceEnabled, forceDisabled, isTemporary, isDisabled] =
      inAttributes;
    return this.onManageActiveEffectFromActiveEffect(
      effectActions,
      owner,
      activeEffect,
      alwaysDelete,
      forceEnabled,
      forceDisabled,
      isTemporary,
      isDisabled,
    );
  }
}
