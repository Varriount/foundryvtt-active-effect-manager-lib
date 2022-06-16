import { debugM, errorM, i18n, isStringEquals, logM, warnM } from '../lib/lib';
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
   * @param {string[]} uuids - UUIDS of the actors to toggle the effect on
   * @param {object} metadata - additional contextual data for the application of the effect (likely provided by midi-qol)
   * @param {string} effectData - data of the effect to toggle (in this case is the add)
   */
  async toggleEffect(effectName, overlay, uuids, metadata = undefined, effectData = undefined) {
    debugM(this.moduleName,
      `START Effect Handler 'toggleEffect' : [overlay=${overlay},uuids=${String(uuids)},metadata=${String(metadata)}]`,
    );
    const effectNames: string[] = [];
    for (const uuid of uuids) {
      if (this.hasEffectApplied(effectName, uuid)) {
        await this.removeEffect(effectName, uuid);
      } else {
        const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
        const origin = `Actor.${actor.id}`;
        await this.addEffect(effectName, effectData, uuid, origin, overlay, metadata);
      }
    }
    debugM(this.moduleName,
      `END Effect Handler 'toggleEffect' : [overlay=${overlay},effectNames=${String(effectNames)},metadata=${String(
        metadata,
      )}]`,
    );
  }

  /**
   * Toggles an effect on or off by name on an actor by UUID
   *
   * @param {string} effectName - name of the effect to toggle
   * @param {object} params - the effect parameters
   * @param {string} params.overlay - name of the effect to toggle
   * @param {string[]} params.uuids - UUIDS of the actors to toggle the effect on
   */
  async toggleEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'toggleEffectArr | inAttributes must be of type array');
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
    debugM(this.moduleName,`START Effect Handler 'hasEffectApplied' : [effectName=${effectName},uuid=${String(uuid)}]`);
    const actor = this._foundryHelpers.getActorByUuid(uuid);
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
    debugM(this.moduleName,`END Effect Handler 'hasEffectApplied' : [effectName=${effectName},actorName=${String(actor.name)}]`);
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
      throw errorM(this.moduleName,'hasEffectAppliedArr | inAttributes must be of type array');
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
  async removeEffect(effectName, uuid) {
    const actor = this._foundryHelpers.getActorByUuid(uuid);
    const effectToRemove = actor.data.effects.find(
      //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && activeEffect?.data?.label == effectName,
      (activeEffect) => activeEffect?.data?.label == effectName,
    );

    if (!effectToRemove) return;

    await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    logM(this.moduleName, `Removed effect ${effectName} from ${actor.name} - ${actor.id}`);
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectArr | inAttributes must be of type array');
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
  async addEffect(effectName, effectData, uuid, origin, overlay = false, metadata = undefined) {
    const actor = this._foundryHelpers.getActorByUuid(uuid);
    let effect = <Effect>this._findEffectByName(effectName, actor);

    if (!effect && effectData) {
      effect = new Effect(effectData);
    }

    if (!origin) {
      origin = `Actor.${actor.id}`;
    }
    effect.origin = origin;
    effect.overlay = overlay;

    this._handleIntegrations(effect);

    effect.origin = origin;
    effect.overlay = overlay;
    const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnActor(effectName, uuid);
    if (activeEffectFounded) {
      warnM(this.moduleName,`Can't add the effect with name ${effectName} on actor ${actor.name}, because is already added`);
      return;
    }
    const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
    await actor.createEmbeddedDocuments('ActiveEffect', [activeEffectData]);
    logM(this.moduleName,`Added effect ${effect.name} to ${actor.name} - ${actor.id}`);
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
  async addEffectArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName, 'addEffectArr | inAttributes must be of type array');
    }
    const [effectName, effectData, uuid, origin, overla, metadata] = inAttributes;
    return this.addEffect(effectName, effectData, uuid, origin, overla, metadata);
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
  _findEffectByName(effectName: string, actor: Actor) {
    if (!effectName) {
      return null;
    }

    let effect:Effect|undefined;
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
  async findEffectByNameOnActor(effectName: string, uuid: string): Promise<ActiveEffect | null> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    let effect: ActiveEffect | null = null;
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
  async findEffectByNameOnActorArr(...inAttributes: any[]): Promise<ActiveEffect | null> {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'findEffectByNameOnActorArr | inAttributes must be of type array');
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
  hasEffectAppliedOnActor(effectName:string, uuid:string, includeDisabled = false): boolean {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = this._foundryHelpers.getActorByUuid(uuid);
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
      throw errorM(this.moduleName,'hasEffectAppliedOnActorArr | inAttributes must be of type array');
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
  hasEffectAppliedFromIdOnActor(effectId, uuid, includeDisabled = false): boolean {
    const actor = this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (<string>activeEffect?.id == effectId) {
          return true;
        } else {
          return false;
        }
      } else {
        if (<string>activeEffect?.id == effectId && !activeEffect.data.disabled) {
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
      throw errorM(this.moduleName,'hasEffectAppliedFromIdOnActorArr | inAttributes must be of type array');
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
  async removeEffectOnActor(effectName, uuid) {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const effectToRemove = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?.label == effectName)
    );

    if (!effectToRemove) return;

    // actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    // Why i need this ??? for avoid the double AE
    // await effectToRemove.update({ disabled: true });
    // await effectToRemove.delete();
    await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    logM(this.moduleName,`Removed effect ${effectName} from ${actor.name} - ${actor.id}`);
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectOnActorArr | inAttributes must be of type array');
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
  async removeEffectFromIdOnActor(effectId, uuid) {
    if (effectId) {
      const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
      //actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemoveId]);
      // Why i need this ??? for avoid the double AE
      const effectToRemove = <ActiveEffect>actorEffects.find((activeEffect) => <string>activeEffect.id == effectId);
      // await effectToRemove.update({ disabled: true });
      // await effectToRemove.delete();
      await actor.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
      logM(this.moduleName,`Removed effect ${effectToRemove?.data?.label} from ${actor.name} - ${actor.id}`);
    }
  }

  /**
   * Removes the effect with the provided name from an actor matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the actor to remove the effect from
   */
  async removeEffectFromIdOnActorArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectFromIdOnActor | inAttributes must be of type array');
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
  async addEffectOnActor(effectName, uuid, origin, overlay, effect: Effect | null) {
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
      effect.origin = origin;
      effect.overlay = overlay;
      const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnActor(effectName, uuid);
      if (activeEffectFounded) {
        warnM(this.moduleName,`Can't add the effect with name ${effectName} on actor ${actor.name}, because is already added`);
        return;
      }
      const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
      await actor.createEmbeddedDocuments('ActiveEffect', [activeEffectData]);
      logM(this.moduleName,`Added effect ${effect.name ? effect.name : effectName} to ${actor.name} - ${actor.id}`);
    }
  }

  /**
   * Adds the effect with the provided name to an actor matching the provided
   * UUID
   *
   * @param {string} effectName - the name of the effect to add
   * @param {string} uuid - the uuid of the actor to add the effect to
   */
  async addEffectOnActorArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'addEffectOnActorArr | inAttributes must be of type array');
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
  ) {
    const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>actor?.data.effects;
    const effect = <ActiveEffect>actorEffects.find((entity: ActiveEffect) => {
      return <string>entity.id == effectId;
    });
    // nuke it if it has a statusId
    // brittle assumption
    // provides an option to always do this
    if (effect.getFlag('core', 'statusId') || alwaysDelete) {
      const deleted = await effect.delete();
      return !!deleted;
    }
    let updated;
    if (forceEnabled && effect.data.disabled) {
      updated = await effect.update({
        disabled: false,
      });
    } else if (forceDisabled && !effect.data.disabled) {
      updated = await effect.update({
        disabled: true,
      });
    } else {
      // otherwise toggle its disabled status
      updated = await effect.update({
        disabled: !effect.data.disabled,
      });
    }

    return !!updated;
  }

  async toggleEffectFromIdOnActorArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'toggleEffectFromIdOnActorArr | inAttributes must be of type array');
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
  async addActiveEffectOnActor(uuid, activeEffectData: ActiveEffectData) {
    if (activeEffectData) {
      const actor = <Actor>this._foundryHelpers.getActorByUuid(uuid);
      if (!activeEffectData.origin) {
        activeEffectData.origin = `Actor.${actor.id}`;
      }
      await actor.createEmbeddedDocuments('ActiveEffect', [<Record<string, any>>activeEffectData]);
      logM(this.moduleName,`Added effect ${activeEffectData.label} to ${actor.name} - ${actor.id}`);
    }
  }

  async addActiveEffectOnActorArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'addActiveEffectOnActorArr | inAttributes must be of type array');
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
  async findEffectByNameOnToken(effectName: string, uuid: string): Promise<ActiveEffect | null> {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    let effect: ActiveEffect | null = null;
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
  async findEffectByNameOnTokenArr(...inAttributes: any[]): Promise<ActiveEffect | null> {
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
  hasEffectAppliedOnToken(effectName, uuid, includeDisabled = false): boolean {
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
      throw errorM(this.moduleName,'hasEffectAppliedOnTokenArr | inAttributes must be of type array');
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
  hasEffectAppliedFromIdOnToken(effectId, uuid, includeDisabled = false): boolean {
    const token = this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const isApplied = actorEffects.some((activeEffect) => {
      if (includeDisabled) {
        if (activeEffect.data._id == effectId) {
          return true;
        } else {
          return false;
        }
      } else {
        if (activeEffect.data._id == effectId && !activeEffect.data.disabled) {
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
      throw errorM(this.moduleName,'hasEffectAppliedFromIdOnTokenArr | inAttributes must be of type array');
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
  async removeEffectOnToken(effectName, uuid) {
    if (effectName) {
      effectName = i18n(effectName);
    }
    const token = this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effectToRemove = <ActiveEffect>(
      actorEffects.find((activeEffect) => <string>activeEffect?.data?.label == effectName)
    );

    if (!effectToRemove) return;

    // token.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    // Why i need this ??? for avoid the double AE
    // await effectToRemove.update({ disabled: true });
    // await effectToRemove.delete();
    await token.actor?.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
    logM(this.moduleName,`Removed effect ${effectName} from ${token.name} - ${token.id}`);
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectName - the name of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectOnTokenArr | inAttributes must be of type array');
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
  async removeEffectFromIdOnToken(effectId: string, uuid: string) {
    if (effectId) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
      const effectToRemove = <ActiveEffect>actorEffects.find(
        //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
        (activeEffect) => <string>activeEffect?.data?._id == effectId,
      );
      if (effectToRemove) {
        // await effectToRemove.update({ disabled: true });
        // await effectToRemove.delete();
        await token.actor?.deleteEmbeddedDocuments('ActiveEffect', [<string>effectToRemove.id]);
        logM(this.moduleName,`Removed effect ${effectToRemove?.data?.label} from ${token.name} - ${token.id}`);
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
  async removeEffectFromIdOnTokenArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectFromIdOnTokenArr | inAttributes must be of type array');
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
  async removeEffectFromIdOnTokenMultiple(effectIds: string[], uuid: string) {
    if (effectIds) {
      const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
      const effectIdsTmp: string[] = [];
      const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
      for (const effectIdTmp of effectIds) {
        const effectToRemove = <ActiveEffect>(
          actorEffects.find((activeEffect) => <string>activeEffect?.data?._id == effectIdTmp)
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
      await token.actor?.deleteEmbeddedDocuments('ActiveEffect', effectIdsTmp);
      logM(this.moduleName,`Removed effect ${effectIds.join(',')} from ${token.name} - ${token.id}`);
    }
  }

  /**
   * Removes the effect with the provided name from an token matching the
   * provided UUID
   *
   * @param {string} effectId - the id of the effect to remove
   * @param {string} uuid - the uuid of the token to remove the effect from
   */
  async removeEffectFromIdOnTokenMultipleArr(...inAttributes: any[]) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'removeEffectFromIdOnTokenMultipleArr | inAttributes must be of type array');
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
  async addEffectOnToken(effectName, uuid, origin, overlay, effect: Effect | null) {
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
      effect.origin = origin;
      effect.overlay = overlay;
      const activeEffectFounded = <ActiveEffect>await this.findEffectByNameOnToken(effectName, uuid);
      if (activeEffectFounded) {
        warnM(this.moduleName,`Can't add the effect with name ${effectName} on token ${token.name}, because is already added`);
        return;
      }
      const activeEffectData = EffectSupport.convertToActiveEffectData(effect);
      await token.actor?.createEmbeddedDocuments('ActiveEffect', [activeEffectData]);
      logM(this.moduleName,`Added effect ${effect.name ? effect.name : effectName} to ${token.name} - ${token.id}`);
    }
  }

  /**
   * Adds the effect with the provided name to an token matching the provided
   * UUID
   *
   * @param {string} effectName - the name of the effect to add
   * @param {string} uuid - the uuid of the token to add the effect to
   */
  async addEffectOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'addEffectOnTokenArr | inAttributes must be of type array');
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
  ) {
    debugM(this.moduleName,
      `START Effect Handler 'toggleEffectFromIdOnToken' : [effetcId=${effectId},uuid=${uuid},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effect = <ActiveEffect>actorEffects.find(
      //(activeEffect) => <boolean>activeEffect?.data?.flags?.isConvenient && <string>activeEffect.id == effectId,
      (activeEffect) => <string>activeEffect?.data?._id == effectId,
    );

    if (!effect) return;
    // nuke it if it has a statusId
    // brittle assumption
    // provides an option to always do this
    if (effect.getFlag('core', 'statusId') || alwaysDelete) {
      const deleted = await effect.delete();
      return !!deleted;
    }
    let updated;
    if (forceEnabled && effect.data.disabled) {
      updated = await effect.update({
        disabled: false,
      });
    } else if (forceDisabled && !effect.data.disabled) {
      updated = await effect.update({
        disabled: true,
      });
    } else {
      // otherwise toggle its disabled status
      updated = await effect.update({
        disabled: !effect.data.disabled,
      });
    }
    debugM(this.moduleName,
      `END Effect Handler 'toggleEffectFromIdOnToken' : [effectName=${effect.name},tokenName=${token.name},alwaysDelete=${alwaysDelete},forceEnabled=${forceEnabled},forceDisabled=${forceDisabled}]`,
    );
    return !!updated;
  }

  async toggleEffectFromIdOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'toggleEffectFromIdOnTokenArr | inAttributes must be of type array');
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
  async addActiveEffectOnToken(uuid, activeEffectData: ActiveEffectData) {
    debugM(this.moduleName,
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
      await token.actor?.createEmbeddedDocuments('ActiveEffect', [<Record<string, any>>activeEffectData]);
      logM(this.moduleName,`Added effect ${activeEffectData.label} to ${token.name} - ${token.id}`);
    }
    debugM(this.moduleName,
      `END Effect Handler 'addActiveEffectOnToken' : [uuid=${uuid},activeEffectData=${activeEffectData}]`,
    );
  }

  async addActiveEffectOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'addActiveEffectOnTokenArr | inAttributes must be of type array');
    }
    const [uuid, activeEffectData] = inAttributes;
    return this.addActiveEffectOnToken(uuid, activeEffectData);
  }

  async updateEffectFromIdOnToken(effectId: string, uuid: string, origin, overlay, effectUpdated: Effect) {
    debugM(this.moduleName,
      `START Effect Handler 'updateEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effect = <ActiveEffect>actorEffects.find((activeEffect) => <string>activeEffect?.data?._id == effectId);

    if (!effect) return;

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
    activeEffectDataUpdated._id = effect.id;
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName,`Updated effect ${effect.data.label} to ${token.name} - ${token.id}`);
    debugM(this.moduleName,
      `END Effect Handler 'updateEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateEffectFromIdOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'updateEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateEffectFromIdOnToken(effectId, uuid, origin, overlay, effectUpdated);
  }

  async updateEffectFromNameOnToken(effectName: string, uuid: string, origin, overlay, effectUpdated: Effect) {
    debugM(this.moduleName,
      `START Effect Handler 'updateEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effect = <ActiveEffect>(
      actorEffects.find((activeEffect) => isStringEquals(<string>activeEffect?.data?.label, effectName))
    );

    if (!effect) return;

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
    activeEffectDataUpdated._id = effect.id;
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName,`Updated effect ${effect.data.label} to ${token.name} - ${token.id}`);
    debugM(this.moduleName,
      `END Effect Handler 'updateEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateEffectFromNameOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'updateEffectFromNameOnTokenArr | inAttributes must be of type array');
    }
    const [effectName, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateEffectFromNameOnToken(effectName, uuid, origin, overlay, effectUpdated);
  }

  async updateActiveEffectFromIdOnToken(
    effectId: string,
    uuid: string,
    origin,
    overlay,
    effectUpdated: ActiveEffectData,
  ) {
    debugM(this.moduleName,
      `START Effect Handler 'updateActiveEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effect = <ActiveEffect>actorEffects.find((activeEffect) => <string>activeEffect?.data?._id == effectId);

    if (!effect) return;

    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    const activeEffectDataUpdated = effectUpdated;
    // if(origin) activeEffectDataUpdated.origin = origin;
    // if(overlay) activeEffectDataUpdated.overlay = overlay;
    activeEffectDataUpdated._id = effect.id;
    //@ts-ignore
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName,`Updated effect ${effect.data.label} to ${token.name} - ${token.id}`);
    debugM(this.moduleName,
      `END Effect Handler 'updateActiveEffectFromIdOnToken' : [effectId=${effectId}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateActiveEffectFromIdOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'updateActiveEffectFromIdOnTokenArr | inAttributes must be of type array');
    }
    const [effectId, uuid, origin, overlay, effectUpdated] = inAttributes;
    return this.updateActiveEffectFromIdOnToken(effectId, uuid, origin, overlay, effectUpdated);
  }

  async updateActiveEffectFromNameOnToken(
    effectName: string,
    uuid: string,
    origin,
    overlay,
    effectUpdated: ActiveEffectData,
  ) {
    debugM(this.moduleName,
      `START Effect Handler 'updateActiveEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    const token = <Token>this._foundryHelpers.getTokenByUuid(uuid);
    const actorEffects = <EmbeddedCollection<typeof ActiveEffect, ActorData>>token.actor?.data.effects;
    const effect = <ActiveEffect>(
      actorEffects.find((activeEffect) => isStringEquals(<string>activeEffect?.data?.label, effectName))
    );

    if (!effect) return;

    if (!origin) {
      const sceneId = (token?.scene && token.scene.id) || canvas.scene?.id;
      // origin = `Scene.${sceneId}.Token.${token.id}`;
      origin = token.actor ? `Actor.${token.actor?.id}` : `Scene.${sceneId}.Token.${token.id}`;
    }
    const activeEffectDataUpdated = effectUpdated;
    // if(origin) activeEffectDataUpdated.origin = origin;
    // if(overlay) activeEffectDataUpdated.overlay = overlay;
    activeEffectDataUpdated._id = effect.id;
    //@ts-ignore
    const updated = await token.actor?.updateEmbeddedDocuments('ActiveEffect', [activeEffectDataUpdated]);
    logM(this.moduleName,`Updated effect ${effect.data.label} to ${token.name} - ${token.id}`);
    debugM(this.moduleName,
      `END Effect Handler 'updateActiveEffectFromNameOnToken' : [effectName=${effectName}, uuid=${uuid}, origin=${origin}, overlay=${overlay}, effectUpdated=${effectUpdated}]`,
    );
    return !!updated;
  }

  async updateActiveEffectFromNameOnTokenArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'updateActiveEffectFromNameOnTokenArr | inAttributes must be of type array');
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
  ):Promise<any> {
    debugM(this.moduleName,
      `START Effect Handler 'onManageActiveEffectFromEffectId' : [effectActions=${effectActions}, owner=${owner.data}, effectId=${effectId},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    const actorEffects = owner?.data.effects;
    const activeEffect = <ActiveEffect>actorEffects.find((activeEffect) => <string>activeEffect?.data?._id == effectId);
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
    debugM(this.moduleName,
      `END Effect Handler 'onManageActiveEffectFromEffectId' : [effectActions=${effectActions}, owner=${owner.data}, effectId=${effectId},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    return response;
  }

  async onManageActiveEffectFromEffectIdArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'onManageActiveEffectFromEffectIdArr | inAttributes must be of type array');
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
  ):Promise<any> {
    debugM(this.moduleName,
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
    debugM(this.moduleName,
      `END Effect Handler 'onManageActiveEffectFromEffect' : [effectActions=${effectActions}, owner=${owner.data}, effect=${effect},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    return response;
  }

  async onManageActiveEffectFromEffectArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'onManageActiveEffectFromEffectArr | inAttributes must be of type array');
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
    activeEffect: ActiveEffect | null | undefined,
    alwaysDelete?: boolean,
    forceEnabled?: boolean,
    forceDisabled?: boolean,
    isTemporary?: boolean,
    isDisabled?: boolean,
  ):Promise<any> {
    debugM(this.moduleName,
      `START Effect Handler 'onManageActiveEffectFromActiveEffect' : [effectActions=${effectActions}, owner=${owner.data}, activeEffect=${activeEffect},
        alwaysDelete=${alwaysDelete}, forceEnabled=${forceEnabled}, forceEnabled=${forceEnabled}, forceDisabled=${forceDisabled}, isTemporary=${isTemporary},
        isDisabled=${isDisabled}]`,
    );
    switch (effectActions) {
      case 'update': {
        if (!activeEffect) {
          warnM(this.moduleName,`Can't retrieve effect to update`);
          return;
        }
        if (owner instanceof Actor) {
          const actor = owner;
          if (!(<ActiveEffect>activeEffect).data.origin) {
            const origin = `Actor.${actor?.id}`;
            setProperty(<ActiveEffectData>activeEffect?.data, 'origin', origin);
          }
          return await actor?.updateEmbeddedDocuments('ActiveEffect', [<any>activeEffect?.data]);
        } else if (owner instanceof Item) {
          const item = owner;
          return await item.update({
            effects: [activeEffect?.data],
          });
        }
        return;
      }
      case 'create': {
        if (!activeEffect) {
          warnM(this.moduleName,`Can't retrieve effect to create`);
          return;
        }
        if (owner instanceof Actor) {
          const actor = owner;
          if (!(<ActiveEffect>activeEffect).data.origin) {
            const origin = `Actor.${actor?.id}`;
            setProperty(<ActiveEffectData>activeEffect?.data, 'origin', origin);
          }
          return await actor?.createEmbeddedDocuments('ActiveEffect', [<any>activeEffect?.data]);
        } else if (owner instanceof Item) {
          const item = owner;
          return await item.update({
            effects: [activeEffect?.data],
          });
        }
        return;
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
          warnM(this.moduleName,`Can't retrieve effect to edit`);
          return;
        }
        return activeEffect?.sheet?.render(true);
      }
      case 'delete': {
        if (!activeEffect) {
          warnM(this.moduleName,`Can't retrieve effect to delete`);
          return;
        }
        return activeEffect?.delete();
      }
      case 'toggle': {
        if (!activeEffect) {
          warnM(this.moduleName,`Can't retrieve effect to toogle`);
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

  async onManageActiveEffectFromActiveEffectArr(...inAttributes) {
    if (!Array.isArray(inAttributes)) {
      throw errorM(this.moduleName,'onManageActiveEffectFromActiveEffectArr | inAttributes must be of type array');
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
