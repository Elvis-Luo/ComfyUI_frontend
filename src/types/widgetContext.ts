import type { ComputedRef, InjectionKey } from 'vue'

import type { WidgetId } from '@comfyorg/graph-model/widgetId'

export const WidgetIdentityKey: InjectionKey<
  ComputedRef<WidgetId | undefined>
> = Symbol()
