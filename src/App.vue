<script setup>

</script>

<template>
  <div id="WindowWrapper">
    <router-view />
  </div>
</template>

<style lang="css" scoped>
#WindowWrapper {
  width: 100vw;
  height: 100vh;
  height: 100svh;
  padding-bottom: env(safe-area-inset-bottom, 20px);
  display: flex;
  flex-direction: column;
  border-style: solid;
  border-width: 1px;
  border-color: rgba(100, 100, 100, 0.1);
  overflow: hidden;
}
</style>
