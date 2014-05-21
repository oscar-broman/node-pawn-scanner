(function () {
  var input = document.getElementById('input');
  var output = document.getElementById('output');
  var reKeyQuotes = /^(\s*)"([a-z]+)"/img;

  input.addEventListener('input', function() {
    var scanResult = scanPawnCode(this.value);

    output.textContent = JSON.stringify(scanResult, null, ' ').replace(reKeyQuotes, '$1$2');
  });
}());