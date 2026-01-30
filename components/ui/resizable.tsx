'use client'

import * as React from 'react'
import { GripVerticalIcon } from 'lucide-react'
import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      data-slot="resizable-panel-group"
      className={cn(
        'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className,
      )}
      {...props}
    />
  )
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

type PanelResizeHandleProps = React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean
}

function ResizableHandle({
  withHandle,
  className,
  onPointerDown,
  ...restProps
}: PanelResizeHandleProps) {
  const [isActive, setIsActive] = React.useState(false)

  React.useEffect(() => {
    if (!isActive) return

    const handlePointerUp = () => {
      setIsActive(false)
    }

    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isActive])

  const handlePointerDown = React.useCallback<React.PointerEventHandler<HTMLDivElement>>(
    (event) => {
      setIsActive(true)
      if (typeof onPointerDown === 'function') {
        ;(onPointerDown as React.PointerEventHandler<HTMLDivElement>)(event)
      }
    },
    [onPointerDown],
  )

  return (
    <ResizablePrimitive.PanelResizeHandle
      data-slot="resizable-handle"
      className={cn(
        'group/resizable-handle focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className,
      )}
      onPointerDown={handlePointerDown as unknown as PanelResizeHandleProps['onPointerDown']}
      {...restProps}
    >
      {withHandle && (
        <div
          className={cn(
            'z-10 flex h-20 w-4 items-center justify-center rounded-full bg-zinc-500 border border-zinc-300/30 opacity-60 transition-all',
            'group-hover/resizable-handle:opacity-100 group-focus-visible/resizable-handle:w-6 group-focus-visible/resizable-handle:opacity-100',
            isActive && 'opacity-100 h-24',
          )}
        >
          {/* <GripVerticalIcon className="h-3 w-3 text-zinc-400" /> */}
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
