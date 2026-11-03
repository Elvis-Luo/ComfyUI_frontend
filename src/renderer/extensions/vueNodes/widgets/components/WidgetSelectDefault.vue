<template>
  <WidgetLayoutField
    :widget
    :input-id="inputId"
    :value-text="selectedSummary"
    :root-class="rowCursor"
    has-leading-button
  >
    <template #between><slot name="between" /></template>
    <ComboboxRoot
      ref="combobox"
      :open="isOpen"
      :model-value="selectedOption ?? null"
      by="key"
      :disabled
      ignore-filter
      selection-behavior="replace"
      :reset-search-term-on-select="false"
      @update:model-value="selectOption"
      @update:open="handleOpenChange"
    >
      <ComboboxAnchor as-child>
        <div
          data-capture-wheel="true"
          :class="
            cn(
              WidgetInputBaseClass,
              'flex w-full min-w-0 items-center overflow-hidden',
              unifiedRows
                ? 'not-disabled:bg-transparent'
                : !disabled && 'hover:bg-muted',
              useWidgetHeight(),
              disabled && 'opacity-50',
              isInvalid && 'ring-1 ring-destructive'
            )
          "
        >
          <ComboboxTrigger as-child>
            <button
              :id="inputId"
              type="button"
              role="combobox"
              aria-haspopup="listbox"
              :aria-controls="listboxId"
              :aria-label="widgetLabel"
              :aria-description="lockedDescription"
              :aria-invalid="isInvalid || undefined"
              :aria-expanded="isOpen"
              :disabled
              tabindex="0"
              data-testid="widget-select-default-trigger"
              class="flex h-full min-w-0 flex-1 cursor-pointer items-center overflow-hidden border-none bg-transparent p-0 outline-none not-disabled:hover:bg-muted disabled:cursor-default"
            >
              <span
                :data-unified="unifiedRows"
                class="min-w-[4ch] flex-1 truncate px-2 text-left data-[unified=true]:text-right"
              >
                {{ displayValue }}
              </span>
              <i
                v-if="lockedDirectory"
                class="mr-1 icon-[lucide--lock] text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          </ComboboxTrigger>
          <slot />
          <template v-if="unifiedRows">
            <button
              v-for="button in stepperButtons"
              :key="button.direction"
              type="button"
              tabindex="-1"
              :aria-label="`${widgetLabel}: ${$t(button.labelKey)}`"
              :disabled="isStepDisabled(button.direction)"
              :class="
                cn(
                  'flex h-full w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent outline-none not-disabled:hover:bg-muted disabled:cursor-default disabled:opacity-30',
                  button.className
                )
              "
              @click="stepOption(button.direction)"
            >
              <i :class="button.icon" aria-hidden="true" />
            </button>
          </template>
          <button
            v-else
            type="button"
            tabindex="-1"
            aria-hidden="true"
            :disabled
            class="flex h-full w-6 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent outline-none disabled:cursor-default"
            @click="handleOpenChange(!isOpen)"
          >
            <i
              class="icon-[lucide--chevron-down] bg-muted-foreground"
              aria-hidden="true"
            />
          </button>
        </div>
      </ComboboxAnchor>

      <ComboboxPortal :key="Number(isOpen)">
        <ComboboxContent
          data-capture-wheel="true"
          data-testid="widget-select-default-overlay"
          role="presentation"
          :aria-orientation="undefined"
          :aria-multiselectable="undefined"
          position="popper"
          :side-offset="1"
          :align="unifiedRows ? 'end' : 'start'"
          :prioritize-position="unifiedRows"
          sticky="always"
          :collision-padding="8"
          :class="
            cn(
              'z-overlay overflow-hidden rounded-lg border border-solid border-border bg-background p-0 shadow-md',
              'max-w-(--reka-combobox-content-available-width) min-w-[min(var(--reka-combobox-trigger-width),var(--reka-combobox-content-available-width))]'
            )
          "
          @keydown.capture="replayNavigationAfterPendingHighlight"
          @keydown.escape.stop="handleOpenChange(false)"
          @focus-outside="handleFocusOutside"
        >
          <div
            v-if="showFolderHeader"
            class="flex min-w-0 items-center gap-2 border-b border-border px-2 py-1 text-xs"
          >
            <span
              class="min-w-0 flex-1 truncate text-muted-foreground"
              :title="folderPath"
              >{{ folderPath }}</span
            >
            <Button
              type="button"
              variant="muted-textonly"
              :disabled="!canLockDirectory"
              :aria-label="lockLabel"
              :aria-pressed="Boolean(lockedDirectory)"
              :tooltip="lockLabel"
              class="size-8 shrink-0 p-0 aria-pressed:bg-secondary aria-pressed:text-foreground"
              @keydown.stop
              @keydown.escape="handleOpenChange(false)"
              @click="toggleFolderLock"
            >
              <i :class="lockIcon" aria-hidden="true" />
            </Button>
          </div>
          <div
            v-if="isFilterable"
            ref="searchInputContainerRef"
            class="m-1 flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors focus-within:border-primary"
          >
            <i
              class="icon-[lucide--search] text-sm text-muted-foreground"
              aria-hidden="true"
            />
            <ComboboxInput
              v-model="searchQuery"
              :placeholder="filterPlaceholder"
              auto-focus
              :aria-label="$t('g.search')"
              :aria-controls="listboxId"
              :aria-activedescendant="activeDescendant"
              data-testid="widget-select-default-search-input"
              class="w-full border-none bg-transparent text-xs outline-none"
            />
          </div>

          <div
            :id="listboxId"
            data-testid="widget-select-default-viewport"
            role="listbox"
            :aria-label="widgetLabel"
            class="min-w-full scrollbar-thin scrollbar-thumb-smoke-500/50 scrollbar-track-transparent scrollbar-gutter-stable overflow-y-auto p-1 text-xs"
            :style="viewportStyle"
            @pointerdown.capture.self="handleViewportPointerDown"
          >
            <div
              aria-hidden="true"
              class="invisible flex h-0 gap-3 overflow-hidden px-2"
            >
              <span class="whitespace-nowrap">{{ longestLabel }}</span>
              <span class="size-3.5 shrink-0" />
            </div>
            <ComboboxVirtualizer
              :key="`${directory.join('/')}:${searchQuery}`"
              v-slot="{ option }"
              :options="browseOptions"
              :estimate-size="32"
              :text-content="(option) => option.label"
            >
              <WidgetSelectOption
                :option
                @select="handleOptionSelect($event, option)"
              />
            </ComboboxVirtualizer>
          </div>
          <div
            v-if="browseOptions.length === 0"
            role="status"
            aria-live="polite"
            class="p-2 text-xs text-muted-foreground"
          >
            {{ $t('g.noResultsFound') }}
          </div>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </WidgetLayoutField>
</template>

<script setup lang="ts">
import { countBy } from 'es-toolkit'
import {
  ComboboxPortal,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxRoot,
  ComboboxTrigger,
  ComboboxVirtualizer
} from 'reka-ui'
import { computed, inject, nextTick, ref, useId, useTemplateRef } from 'vue'
import type { CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'

import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import Button from '@comfyorg/design-system/button/Button'
import { useRestoreFocusOnViewportPointer } from '@/renderer/extensions/vueNodes/widgets/composables/useRestoreFocusOnViewportPointer'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { WidgetIdentityKey } from '@/types/widgetContext'
import { UnifiedWidgetRowsKey } from '@/types/widgetRowLayout'
import { useWidgetHeight } from '@/types/widgetTypes'
import { cn } from '@comfyorg/tailwind-utils'

import { WidgetInputBaseClass } from './layout'
import WidgetLayoutField from './layout/WidgetLayoutField.vue'
import WidgetSelectOption from './WidgetSelectOption.vue'

interface Props {
  widget: SimplifiedWidget<string | undefined>
  filenameSummary?: boolean
}

interface SelectOption {
  kind: 'value'
  key: string
  label: string
  rawValue: NonNullable<WidgetValue>
  value: string
}

interface SelectFolder {
  kind: 'folder' | 'back'
  key: string
  label: string
  directory: string[]
}

type SelectWidgetOptions = NonNullable<Props['widget']['options']> & {
  filterPlaceholder?: string
}

const { widget, filenameSummary = false } = defineProps<Props>()
const { t } = useI18n()
const unifiedRows = inject(UnifiedWidgetRowsKey, false)
const inputId = useId()
const widgetLabel = computed(() => widget.label || widget.name)
const listboxId = useId()

const MAX_VISIBLE_OPTIONS = 15
const stepperButtons = [
  {
    direction: -1,
    labelKey: 'g.previous',
    icon: 'icon-[lucide--chevron-left] text-muted-foreground',
    className: 'absolute inset-y-0 left-0'
  },
  {
    direction: 1,
    labelKey: 'g.next',
    icon: 'icon-[lucide--chevron-right] text-muted-foreground',
    className: ''
  }
] as const

function resolveRawValues(values: unknown): unknown[] {
  try {
    const resolved = typeof values === 'function' ? values() : values
    return Array.isArray(resolved) ? resolved : []
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to resolve options', error)
    return []
  }
}

function toWidgetValue(value: unknown): NonNullable<WidgetValue> {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (typeof value === 'object' && value !== null)
  ) {
    return value
  }

  return String(value)
}

function resolveValues(values: unknown) {
  return resolveRawValues(values)
    .filter((value) => value !== null && value !== undefined)
    .map((rawValue) => ({
      rawValue: toWidgetValue(rawValue),
      value: String(rawValue)
    }))
}

const modelValue = defineModel<WidgetValue>({
  default(modelProps: Record<string, unknown>) {
    try {
      const modelWidget = modelProps.widget as Props['widget'] | undefined
      const values = modelWidget?.options?.values
      const resolved = typeof values === 'function' ? values() : values
      const firstValue = Array.isArray(resolved)
        ? resolved.find((value) => value !== null && value !== undefined)
        : undefined
      return firstValue === undefined ? '' : firstValue
    } catch (error) {
      console.error('[WidgetSelectDefault] Failed to resolve options', error)
      return ''
    }
  }
})

const searchQuery = ref('')
const directory = ref<string[]>([])
const localFolderLock = ref<string[]>()
const widgetIdentity = inject(WidgetIdentityKey, undefined)
const widgetValueStore = useWidgetValueStore()
const lockedDirectory = computed(() =>
  widgetIdentity?.value
    ? widgetValueStore.getWidgetFolderLock(widgetIdentity.value)?.directory
    : localFolderLock.value
)
const combobox = useTemplateRef('combobox')
const optionsRefreshKey = ref(0)
const isOpen = ref(false)
const searchInputContainerRef = ref<HTMLElement>()
const { handleFocusOutside, handleViewportPointerDown } =
  useRestoreFocusOnViewportPointer(focusSearchInput)

const widgetOptions = computed(
  () => widget.options as SelectWidgetOptions | undefined
)

const dynamicOptions = computed(
  () => typeof widgetOptions.value?.values === 'function'
)
const disabled = computed(() => Boolean(widgetOptions.value?.disabled))
const rowCursor = computed(() =>
  unifiedRows && !disabled.value ? 'cursor-pointer' : undefined
)
const placeholder = computed(() => widgetOptions.value?.placeholder ?? '')
const filterPlaceholder = computed(
  () => widgetOptions.value?.filterPlaceholder ?? placeholder.value
)

function refreshOptions() {
  optionsRefreshKey.value++
}

function getOptionLabel(value: string) {
  const labeler = widgetOptions.value?.getOptionLabel
  if (!labeler) return value

  try {
    return labeler(value) || value
  } catch (error) {
    console.error('[WidgetSelectDefault] Failed to map option label', error)
    return value
  }
}

const normalizedOptions = computed<SelectOption[]>(() => {
  void optionsRefreshKey.value

  return resolveValues(widgetOptions.value?.values).map(
    ({ rawValue, value }) => ({
      kind: 'value',
      key: `value:${value}`,
      label: getOptionLabel(value),
      rawValue,
      value
    })
  )
})

const hasFolders = computed(
  () =>
    unifiedRows &&
    !widgetOptions.value?.getOptionLabel &&
    normalizedOptions.value.some((option) => isFilePath(option.value))
)

function isFilePath(value: string) {
  return /[/\\][^/\\]+\.[a-z][a-z0-9]{0,15}$/i.test(value)
}

const isFilterable = computed(
  () =>
    hasFolders.value ||
    Boolean(lockedDirectory.value) ||
    normalizedOptions.value.length > 4
)

function isInDirectory(value: string, path: string[]) {
  if (!isFilePath(value)) return false
  const parts = value.split(/[/\\]/).filter(Boolean).slice(0, -1)
  return path.every((part, index) => parts[index] === part)
}

const scopedOptions = computed(() => {
  const path = lockedDirectory.value
  return path
    ? normalizedOptions.value.filter((option) =>
        isInDirectory(option.value, path)
      )
    : normalizedOptions.value
})

const folderPath = computed(
  () =>
    (lockedDirectory.value ?? directory.value).join(' / ') ||
    t('widgets.allFolders')
)
const lockIcon = computed(() =>
  lockedDirectory.value ? 'icon-[lucide--lock]' : 'icon-[lucide--lock-open]'
)
const showFolderHeader = computed(
  () => hasFolders.value || Boolean(lockedDirectory.value)
)
const canLockDirectory = computed(
  () => Boolean(lockedDirectory.value) || directory.value.length > 0
)
const lockedDescription = computed(() =>
  lockedDirectory.value
    ? t(
        'widgets.folderLocked',
        { name: lockedDirectory.value.join(' / ') },
        { escapeParameter: false }
      )
    : undefined
)
const displayValue = computed(
  () => selectedSummary.value || placeholder.value || '\u00a0'
)
const lockLabel = computed(() =>
  lockedDirectory.value
    ? t(
        'widgets.unlockFolder',
        { name: folderPath.value },
        { escapeParameter: false }
      )
    : directory.value.length
      ? t(
          'widgets.lockFolder',
          { name: folderPath.value },
          { escapeParameter: false }
        )
      : t('widgets.browseToLockFolder')
)

async function toggleFolderLock() {
  const path = lockedDirectory.value ? undefined : [...directory.value]
  if (widgetIdentity?.value) {
    widgetValueStore.setWidgetFolderLock(
      widgetIdentity.value,
      path ? { directory: path } : undefined
    )
    useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  } else {
    localFolderLock.value = path
  }
  await nextTick()
  focusSearchInput()
}

const filteredOptions = computed(() => {
  if (!isFilterable.value) return scopedOptions.value

  const query = searchQuery.value.trim().toLocaleLowerCase()
  if (!query) return scopedOptions.value

  return scopedOptions.value.filter(
    (option) =>
      option.value.toLocaleLowerCase().includes(query) ||
      option.label.toLocaleLowerCase().includes(query)
  )
})

const browseOptions = computed<Array<SelectOption | SelectFolder>>(() => {
  if (!hasFolders.value || searchQuery.value.trim())
    return filteredOptions.value

  const folders = new Map<string, SelectFolder>()
  const files: SelectOption[] = []
  for (const option of scopedOptions.value) {
    const parts = isFilePath(option.value)
      ? option.value.split(/[/\\]/).filter(Boolean)
      : [option.value]
    if (!directory.value.every((part, index) => parts[index] === part)) continue
    const label = parts[directory.value.length]
    if (label === undefined) continue
    if (parts.length === directory.value.length + 1) {
      files.push({ ...option, label })
    } else if (!folders.has(label)) {
      const path = [...directory.value, label]
      folders.set(label, {
        kind: 'folder',
        key: `folder:${path.join('/')}`,
        label,
        directory: path
      })
    }
  }
  const labelCounts = countBy(files, (option) => option.label)
  return [
    ...(directory.value.length > (lockedDirectory.value?.length ?? 0)
      ? [
          {
            kind: 'back' as const,
            key: 'back',
            label: directory.value.join(' / '),
            directory: directory.value.slice(0, -1)
          }
        ]
      : []),
    ...folders.values(),
    ...files.map((option) =>
      labelCounts[option.label] > 1
        ? { ...option, label: option.value }
        : option
    )
  ]
})

const viewportStyle = computed<CSSProperties>(() => ({
  maxHeight: unifiedRows
    ? `min(30.5rem, max(2rem, calc(var(--reka-combobox-content-available-height, 100dvh) - ${showFolderHeader.value ? '5.5rem' : '3rem'})))`
    : '14rem',
  overflowY:
    browseOptions.value.length > MAX_VISIBLE_OPTIONS ? 'scroll' : 'auto',
  scrollbarGutter: 'stable'
}))

const activeDescendant = computed((): string | undefined =>
  browseOptions.value.length
    ? combobox.value?.highlightedElement?.id
    : undefined
)

const normalizedModelValue = computed(() =>
  modelValue.value == null ? undefined : String(modelValue.value)
)

const selectedOption = computed(() =>
  normalizedOptions.value.find(
    (option) => option.value === normalizedModelValue.value
  )
)

const longestLabel = computed(() =>
  normalizedOptions.value.reduce(
    (longest, { label }) => (label.length > longest.length ? label : longest),
    ''
  )
)

const isInvalid = computed(
  () =>
    widgetOptions.value?.values !== undefined &&
    modelValue.value != null &&
    modelValue.value !== '' &&
    !selectedOption.value
)

const selectedLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label
  if (isInvalid.value) return String(modelValue.value)
  return ''
})

const selectedSummary = computed(() =>
  filenameSummary && !widgetOptions.value?.getOptionLabel
    ? selectedLabel.value.split(/[/\\]/).at(-1)
    : selectedLabel.value
)

async function handleOptionSelect(
  event: Event,
  option: SelectOption | SelectFolder
) {
  if (option.kind === 'value') return
  event.preventDefault()
  directory.value = option.directory
  await nextTick()
  focusSearchInput()
  combobox.value?.highlightFirstItem?.()
}

function selectOption(option: SelectOption | SelectFolder | null) {
  if (!option || option.kind !== 'value') return

  modelValue.value = option.rawValue
  useWorkflowStore().activeWorkflow?.changeTracker.captureCanvasState()
  searchQuery.value = ''
  isOpen.value = false
}

function adjacentOption(direction: -1 | 1) {
  const options = scopedOptions.value
  const index =
    selectedOption.value && options.includes(selectedOption.value)
      ? options.indexOf(selectedOption.value)
      : direction === 1
        ? -1
        : options.length
  return options[index + direction]
}

function isStepDisabled(direction: -1 | 1) {
  return disabled.value || (!dynamicOptions.value && !adjacentOption(direction))
}

function stepOption(direction: -1 | 1) {
  refreshOptions()
  const option = adjacentOption(direction)
  if (option) selectOption(option)
}

function focusSearchInput() {
  const input =
    searchInputContainerRef.value?.querySelector<HTMLInputElement>('input')
  if (!input) return false

  input.focus({ preventScroll: true })
  return true
}

const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'Home',
  'End',
  'PageDown',
  'PageUp',
  'Enter'
])

function replayNavigationAfterPendingHighlight(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLButtonElement ||
    !event.isTrusted ||
    event.isComposing ||
    !NAVIGATION_KEYS.has(event.key)
  )
    return
  const { target } = event
  event.preventDefault()
  event.stopPropagation()
  requestAnimationFrame(() =>
    target?.dispatchEvent(new KeyboardEvent(event.type, event))
  )
}

function handleOpenChange(open: boolean) {
  isOpen.value = open

  if (open) {
    refreshOptions()
    const value = selectedOption.value?.value ?? ''
    directory.value =
      lockedDirectory.value && !isInDirectory(value, lockedDirectory.value)
        ? [...lockedDirectory.value]
        : hasFolders.value && isFilePath(value)
          ? value.split(/[/\\]/).filter(Boolean).slice(0, -1)
          : []
  } else {
    searchQuery.value = ''
  }
}
</script>
