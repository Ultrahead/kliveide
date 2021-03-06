<script>
  // ==========================================================================
  // This component implements the view for the Memory editor.

  import { onMount, tick } from "svelte";
  import { vscodeApi } from "../messaging/messaging-core";
  import ConnectionPanel from "../controls/ConnectionPanel.svelte";
  import RefreshPanel from "../controls/RefreshPanel.svelte";
  import HeaderShadow from "../controls/HeaderShadow.svelte";
  import VirtualList from "../controls/VirtualList.svelte";
  import MemoryPagingPanel from "../controls/MemoryPagingPanel.svelte";
  import MemoryEntry from "./MemoryEntry.svelte";
  import { memory, LINE_SIZE } from "./MemoryView";

  // --- Disassembly items to display
  let items = [];

  // --- Indicates if Klive emulator is connected
  let connected = true;

  // --- Indicates if the view is refreshed
  let refreshed = true;

  // --- Indicates if the viewport is refreshing
  let isRefreshing = false;

  // --- The API of the virtual list component
  let virtualListApi;

  // --- The index of the visible item at the top
  let startItemIndex;

  // --- The index of the last visible ite at the bottom
  let endItemIndex;

  // --- The item index of the top hem item
  let topHemItemIndex;

  // --- The item index of the bottom hem item
  let bottomHemItemIndex;

  // --- Is the view currently scrolling?
  let scrolling = false;

  // --- Current value of registers
  let registers;

  // --- Type of the current machine
  let machineType;

  // --- Configuration of the current machine
  let machineConfig;

  // --- Memory page information
  let pageInfo;

  // --- View information
  let viewMode;
  let displayedRom;
  let displayedBank;

  // --- The last time the view was scrolled
  let lastScrollTime = 0;

  onMount(() => {
    // --- Subscribe to the messages coming from the WebviewPanel
    window.addEventListener("message", async (ev) => {
      if (ev.data.viewNotification) {
        switch (ev.data.viewNotification) {
          case "connectionState":
            // --- Refresh after reconnection
            connected = ev.data.state;
            if (!connected) {
              refreshed = false;
              await refreshViewPort();
              refreshed = true;
            }
            break;
          case "machineType":
            machineType = ev.data.type;
            machineConfig = ev.data.config;
            viewMode = 0;
          // --- This case intentionally flows to the next
          case "memoryPaging":
            if (machineConfig) {
              const paging = machineConfig.paging;
              if (paging) {
                pageInfo = {
                  supportsPaging: paging.supportsPaging,
                  roms: paging.roms,
                  banks: paging.banks,
                  selectedRom: ev.data.selectedRom,
                  selectedBank: ev.data.selectedBank,
                };
              }
            }
            break;
          case "registers":
            // --- Register values sent
            registers = ev.data.registers;
            break;
          case "goToAddress":
            await scrollToAddress(ev.data.address || 0);
            break;
          case "refreshViewPort":
            if (isRefreshing) break;
            isRefreshing = true;
            try {
              if (lastScrollTime !== 0 && Date.now() - lastScrollTime < 500) {
                break;
              }
              await refreshViewPort(ev.data.fullRefresh);
              let pos = ev.data.itemIndex;
              if (pos !== undefined) {
                if (pos < 0) {
                  pos = restoreViewState(ev.data);
                } else {
                  pos = items[pos] && items[pos].address;
                }
                if (pos !== undefined) {
                  await tick();
                  await scrollToAddress(pos || 0);
                }
              }
            } finally {
              isRefreshing = false;
            }
            refreshed = true;
            break;
        }
      }
    });

    // --- No, the component is initialized, notify the Webview
    // --- and ask it to refresh this view
    vscodeApi.postMessage({ command: "refresh" });
  });

  $: {
    (function () {
      vscodeApi.postMessage({ command: "changeView" });
    })(viewMode, displayedRom, displayedBank);
  }

  // --- Refresh the specified part of the viewport
  async function refreshViewPort(fullRefresh) {
    try {
      const viewportItems = await memory(viewMode, displayedRom, displayedBank);
      if (!viewportItems) {
        return;
      }
      if (!items || items.length === 0 || fullRefresh) {
        items = viewportItems;
      } else {
        for (let i = topHemItemIndex; i <= bottomHemItemIndex; i++) {
          items[i] = viewportItems[i];
        }
      }
      if (virtualListApi) {
        await virtualListApi.refreshContents();
      }
    } catch (err) {
      console.log(err);
    }
  }

  // --- Scroll to the specified address
  async function scrollToAddress(address) {
    if (virtualListApi) {
      let found = items.findIndex((it) => it.address >= address);
      if (found >= 0 && items[found].address > address) {
        found--;
      }
      found = Math.max(0, found);
      scrolling = true;
      await virtualListApi.scrollToItem(found);
      await saveViewState();
      scrolling = false;
      await new Promise((r) => setTimeout(r, 10));
      if (virtualListApi) {
        await virtualListApi.refreshContents();
      }
    }
  }

  // --- Save the current view state
  async function saveViewState() {
    await tick();
    const item = items[startItemIndex];
    if (item) {
      vscodeApi.setState({ scrollPos: item.address });
    }
  }

  // --- Restores the saved state
  function restoreViewState() {
    const state = vscodeApi.getState();
    return state ? state.scrollPos : null;
  }
</script>

<style>
  .component {
    display: flex;
    flex-direction: column;
    flex-grow: 0;
    flex-shrink: 0;
    height: 100%;
    width: 100%;
    position: relative;
    user-select: none;
  }
</style>

<div class="component">
  {#if !connected}
    <ConnectionPanel />
  {:else}
    {#if !refreshed}
      <RefreshPanel text="Refreshing Memory view..." />
    {/if}
    {#if pageInfo && pageInfo.supportsPaging}
      <MemoryPagingPanel
        {pageInfo}
        bind:viewMode
        bind:displayedRom
        bind:displayedBank />
    {/if}
    <HeaderShadow />
    <VirtualList
      {items}
      itemHeight={20}
      topHem={5}
      bottomHem={5}
      let:item
      bind:api={virtualListApi}
      bind:startItemIndex
      bind:endItemIndex
      bind:topHemItemIndex
      bind:bottomHemItemIndex
      on:scrolled={async () => {
        if (!scrolling) {
          await saveViewState();
        }
        lastScrollTime = Date.now();
      }}>
      <MemoryEntry
        {item}
        {registers}
        displayRegisters={!viewMode}
        {machineType}
        {viewMode} />
    </VirtualList>
  {/if}
</div>
