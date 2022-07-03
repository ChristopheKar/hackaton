export function arrayToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa(binary);
}


export function sleep(ms) {
  console.log(`Waiting for ${ms}ms`);
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
